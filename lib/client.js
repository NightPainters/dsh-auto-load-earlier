window.__ModuleLoader__.load({id:"dsh-auto-load-earlier",factory:(require)=>{var module={exports:{}};var exports=module.exports;

/**
 * dsh-auto-load-earlier — browser half.
 *
 * Why this exists: the chat transcript keeps only a tail window of events
 * resident, and the only way to page earlier history is the "Load earlier"
 * button. Reaching the top therefore stops the reading flow: stop, aim, click,
 * wait. This plugin restores continuous reading by dispatching a click on that
 * very button, so the load takes the identical path a human click takes (cancel
 * in-flight work, preserve the scroll anchor, pause tail-following).
 *
 * Two triggers:
 *  - proximity: wheeling/scrolling inside `thresholdPx` of the top (the old,
 *    cautious behaviour — fine for short hops);
 *  - velocity: a fast upward wheel burst prefetches up to `fastZoneScreens`
 *    screens early, so a reader who flicks back several screens never hits a
 *    dead end. Velocity triggers are gated only by a tiny re-entry gap, because
 *    the natural brake is the button itself (disabled / "loading" label).
 *
 * It owns no data and no API surface: once the shipped button is disabled or
 * gone (loading, or no more history) every trigger is a no-op.
 */

const PACKAGE_ID = "dsh-auto-load-earlier";
const FLOW_SELECTOR = "[data-chat-flow]";

const DEFAULTS = {
  /** Proximity trigger: start loading once the scrollport is within this many px of the top. */
  thresholdPx: 140,
  /** Upward distance that must accumulate before a proximity trigger. */
  minUpScrollPx: 48,
  /** Minimum gap between two proximity triggers, covering the button's re-render window. */
  cooldownMs: 900,
  /** Velocity trigger: wheel-up speed (px/s) that counts as "flicking backwards". */
  fastWheelPxPerSec: 900,
  /** Burst trigger: upward distance (in screens) inside one sample window that is already a flick. */
  fastBurstScreens: 1,
  /** Velocity prefetch reaches this many viewport heights above the visible top. */
  fastZoneScreens: 3,
  /** Sliding window used to compute wheel velocity. */
  fastSampleMs: 160,
  /** Re-entry gap for velocity triggers; the loading button is the real brake. */
  fastGapMs: 150,
  /** Consecutive velocity prefetches allowed in one flick before only proximity remains. */
  fastMaxRun: 8,
  /** Quiet time that ends a flick and resets the consecutive counter. */
  fastRunResetMs: 2000,
};

/** Ready labels only — "loading" labels are excluded so a busy button is never re-clicked. */
const READY_LABEL = /^(加载更早|Load earlier)/;

function tuning() {
  const override = globalThis.__DSH_AUTOLOAD_TUNING__;
  if (override === undefined || override === null || typeof override !== "object") return DEFAULTS;
  const pick = (key) => (typeof override[key] === "number" ? override[key] : DEFAULTS[key]);
  return {
    thresholdPx: pick("thresholdPx"),
    minUpScrollPx: pick("minUpScrollPx"),
    cooldownMs: pick("cooldownMs"),
    fastWheelPxPerSec: pick("fastWheelPxPerSec"),
    fastBurstScreens: pick("fastBurstScreens"),
    fastZoneScreens: pick("fastZoneScreens"),
    fastSampleMs: pick("fastSampleMs"),
    fastGapMs: pick("fastGapMs"),
    fastMaxRun: pick("fastMaxRun"),
    fastRunResetMs: pick("fastRunResetMs"),
  };
}

/** Per-scrollport motion memory; weak so a disposed ChatView is collectable. */
const lastTop = new WeakMap();
const upward = new WeakMap();
/** Per-scrollport wheel sample points inside the velocity window: { points: [{ t, d }] }. */
const wheelRun = new WeakMap();

let lastTriggerAt = 0;
let lastFastTriggerAt = 0;
/** Consecutive velocity prefetches in the current flick. */
let fastRunCount = 0;

/** True when `element` is the chat scrollport that owns a transcript column. */
function isChatScrollport(element) {
  if (element === null || typeof element !== "object" || element.nodeType !== 1) return false;
  try {
    return element.querySelector(":scope > " + FLOW_SELECTOR) !== null;
  } catch {
    return false;
  }
}

/** The transcript column inside a scrollport. */
function flowColumnOf(scrollport) {
  return scrollport.querySelector(":scope > " + FLOW_SELECTOR);
}

/**
 * The shipped "Load earlier" control. It is the first button the column renders
 * — the hints and the error row above it are plain divs — so this does not scan
 * the transcript itself.
 */
function loadButtonOf(scrollport) {
  const column = flowColumnOf(scrollport);
  if (column === null) return null;
  const button = column.querySelector("button");
  if (button === null || button.disabled) return null;
  const label = (button.textContent ?? "").trim();
  return READY_LABEL.test(label) ? button : null;
}

function clickButton(scrollport) {
  const button = loadButtonOf(scrollport);
  if (button === null) return false;
  upward.set(scrollport, 0);
  button.click();
  return true;
}

function trigger(scrollport, now) {
  if (now - lastTriggerAt < tuning().cooldownMs) return false;
  if (!clickButton(scrollport)) return false;
  lastTriggerAt = now;
  return true;
}

function triggerFast(scrollport, now) {
  const config = tuning();
  if (now - lastFastTriggerAt < config.fastGapMs) return false;
  if (now - lastFastTriggerAt > config.fastRunResetMs) fastRunCount = 0;
  if (fastRunCount >= config.fastMaxRun) return false;
  if (!clickButton(scrollport)) return false;
  lastFastTriggerAt = now;
  fastRunCount += 1;
  return true;
}

/** Upward wheel distance in CSS px, normalising DOM_DELTA_LINE / DOM_DELTA_PAGE. */
function upwardPixels(event, scrollport) {
  if (event.deltaY >= 0) return 0;
  const magnitude = -event.deltaY;
  if (event.deltaMode === 1) return magnitude * 16;
  if (event.deltaMode === 2) return magnitude * Math.max(scrollport.clientHeight, 1);
  return magnitude;
}

/**
 * Sliding-window wheel motion for one scrollport: upward speed in px/s and the
 * raw upward distance accumulated inside the same window. Speed is measured
 * from the first *timestamp* but the first event's distance is excluded — using
 * both would double-count the opening notch and read a 12-notch/s wheel as
 * 1155 px/s instead of 576 px/s.
 */
function wheelMotion(scrollport, distance, now, windowMs) {
  let run = wheelRun.get(scrollport);
  if (run === undefined) {
    run = { points: [] };
    wheelRun.set(scrollport, run);
  }
  const points = run.points;
  points.push({ t: now, d: distance });
  while (points.length > 0 && now - points[0].t > windowMs) points.shift();
  let burst = 0;
  for (const point of points) burst += point.d;
  const span = points.length > 1 ? now - points[0].t : 0;
  const speed = span > 0 ? ((burst - points[0].d) / span) * 1000 : 0;
  return { speed, burst };
}

/** Wheel-up: velocity prefetch first, proximity trigger as the fallback. */
function onWheel(event) {
  if (event.deltaY >= 0) return;
  const target = event.target;
  if (target === null || typeof target.closest !== "function") return;
  const column = target.closest(FLOW_SELECTOR);
  if (column === null) return;
  const scrollport = column.parentElement;
  if (!isChatScrollport(scrollport)) return;

  const config = tuning();
  const now = Date.now();

  const distance = upwardPixels(event, scrollport);
  if (distance <= 0) return;

  const motion = wheelMotion(scrollport, distance, now, config.fastSampleMs);
  const burstLimit = Math.max(scrollport.clientHeight, 1) * config.fastBurstScreens;
  if (motion.speed >= config.fastWheelPxPerSec || motion.burst >= burstLimit) {
    const zone = Math.max(config.thresholdPx, scrollport.clientHeight * config.fastZoneScreens);
    if (scrollport.scrollTop <= zone) {
      triggerFast(scrollport, now);
      return;
    }
  }

  if (scrollport.scrollTop <= config.thresholdPx) trigger(scrollport, now);
}

/**
 * Scroll-driven fallback for keyboard paging and scrollbar drags. The upward
 * distance is accumulated per scrollport and reset as soon as the reader
 * reverses, so brushing the top edge does not fire.
 */
function onScroll(event) {
  const scrollport = event.target;
  if (!isChatScrollport(scrollport)) return;

  const config = tuning();
  const top = scrollport.scrollTop;
  const previous = lastTop.get(scrollport);
  lastTop.set(scrollport, top);

  if (previous === undefined) return;
  if (top < previous - 1) {
    upward.set(scrollport, (upward.get(scrollport) ?? 0) + (previous - top));
  } else if (top > previous + 1) {
    upward.set(scrollport, 0);
    return;
  } else if (top > config.thresholdPx) {
    return;
  }

  if (top > config.thresholdPx) return;
  if ((upward.get(scrollport) ?? 0) < config.minUpScrollPx) return;
  trigger(scrollport, Date.now());
}

function apply(ctx) {
  ctx.effect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    document.addEventListener("wheel", onWheel, { capture: true, passive: true, signal });
    document.addEventListener("scroll", onScroll, { capture: true, passive: true, signal });
    return () => controller.abort();
  }, PACKAGE_ID + ": scroll-driven history autoload");
}

exports.apply = apply;
return module.exports;}});
