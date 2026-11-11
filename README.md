# dsh-auto-load-earlier

**English** | [简体中文](README.zh.md)

Scroll-driven history autoload for the DSH (DeepSeek Harness) web client — **no more stopping to click "Load earlier" at the top of a transcript.**

The chat view keeps only a tail window of the transcript resident. Scroll to the top and it stops: you have to aim at a button, click it, and wait for a page to arrive. This plugin removes that step — when it detects that you are scrolling up, it clicks the button for you. It goes through the same official path as a real click (cancel in-flight work → preserve the scroll anchor → pause tail-following), touches no data layer, and patches no official package.

## Two triggers

| Mode | Condition | Purpose |
|---|---|---|
| Proximity | within 140px of the top, and ≥48px of accumulated upward scroll | reading back one page at a time |
| Velocity (prefetch) | upward speed ≥ 900 px/s, or one viewport within 160ms — while within 3 screens of the top | jumping back to much earlier history |

Velocity mode starts **3 screens early**, so by the time you reach the top the next page is already loading. Consecutive prefetches are capped (8 pages per fling, counter reset after 2s idle) so that a single fling cannot mount thousands of rows at once.

Slow scrolling never misfires: 0 triggers measured at 4–16 wheel notches/s in Firefox line mode and 3–6 notches/s in pixel mode.

## Install

Install it as a local plugin on the profile.

1. Drop this repository into `dsh-home/plugins-local/` as `dsh-auto-load-earlier`.
2. Append to `dsh-home/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: auto-load-earlier
      name: ../../plugins-local/dsh-auto-load-earlier/lib/index.js
```

3. Save. The patch hot-loads in about a minute, then **Ctrl+Shift+R** to hard-reload the page.

To disable: delete that block, or add `disabled: true` to it. Takes about a minute; no restart needed.

> Do not use `dsh plugin add` for this. It re-links `node_modules`, which on Windows can crash a running process (native modules are already loaded and cannot be replaced). A path insert is safer.

## Tuning

Tune at runtime from the console; changes apply on the next page load, no plugin reload needed:

```js
__DSH_AUTOLOAD_TUNING__ = {
  thresholdPx: 140,        // proximity zone, px from the top
  minUpScrollPx: 48,       // accumulated upward scroll required in proximity mode
  cooldownMs: 900,         // min gap between proximity triggers
  fastWheelPxPerSec: 900,  // velocity threshold
  fastBurstScreens: 1,     // or: viewports scrolled within one sample window
  fastZoneScreens: 3,      // prefetch starts this many screens above the viewport
  fastSampleMs: 160,       // velocity sampling window
  fastGapMs: 150,          // re-entry gap for velocity triggers
  fastMaxRun: 8,           // max pages per fling
  fastRunResetMs: 2000,    // idle time that resets the fling counter
};

__DSH_AUTOLOAD_TUNING__ = null; // restore defaults
```

Too eager? Raise `fastWheelPxPerSec` to 1500, or lower `fastZoneScreens` to 2.

## How it works

- The scrollport is located by the stable `[data-chat-flow]` attribute (not CSS-module hashed class names, which change per build).
- "Load earlier" is the first `button` rendered inside the transcript column; the plugin matches that position plus the label `加载更早 / Load earlier`.
- The trigger is `button.click()` — the exact same code path as a human click.
- A disabled button, or one whose label has switched to a loading state, is never clicked, so the load cannot re-enter.

The plugin holds no data and exposes no API. When the button is gone or disabled, every trigger is a no-op.

## Limitations

- **Trigger only, not rendering.** A page is still 500 rows mounted at once, and the 300–630ms main-thread hitch remains — it is merely hidden by scroll momentum. Real render windowing is tracked upstream in [#7579](https://github.com/deepseek-ai/deepseek-harness/discussions/7579).
- History outside the resident window occupies no memory until loaded; once loaded it is not unloaded automatically.
- Depends on the `[data-chat-flow]` DOM structure and the button label. Either changing upstream breaks it.
- Calibrated on Firefox 159 only. Chromium reports pixel-mode deltas and the normalization handles that, but the thresholds were not verified notch-by-notch there.

## Related

- Upstream uses Discussions, not Issues (the Issues tab is closed).
- Relevant threads: `#359` (page freezes after long tasks), `#7579` (chat collapse hides but does not unmount; a render-windowing patch exists), `#3726` (multi-MB pages time out history fetches), `#6200` (process collapse silently disabled while paging is incomplete).

## License

MIT
