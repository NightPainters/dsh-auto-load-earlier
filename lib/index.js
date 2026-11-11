/**
 * Host half of dsh-auto-load-earlier.
 *
 * The whole behaviour lives in the web client (./client.js): it observes the
 * chat scrollport and triggers the existing "Load earlier" button when the
 * reader wheels up near the top. Nothing on the host side is needed, so this
 * entry stays empty — it only keeps the loader row a valid profile member and
 * carries the package manifest that `dsh.client` discovery reads.
 */
export const name = "dsh-auto-load-earlier";

/** @param _ctx - host cordis context (unused). */
export function apply(_ctx) {
  // Intentionally empty.
}
