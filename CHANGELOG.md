# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-11-11

First tagged release.

### Added

- **Velocity prefetch.** A fast upward wheel burst loads earlier history up to
  three viewport heights before the top, so flicking back several screens no
  longer dead-ends at the boundary. The trigger is either `>= 900 px/s` or one
  full viewport within a 160 ms sampling window, whichever comes first.
- **Bounded continuous prefetch.** At most 8 pages per flick; the counter resets
  after 2 s idle, so one gesture cannot mount an entire transcript.
- **Runtime tuning.** Ten keys via `window.__DSH_AUTOLOAD_TUNING__`, no reload
  required. Set to `null` to restore defaults.
- **Bilingual docs.** English `README.md` plus `README.zh.md`.

### Changed

- The proximity trigger (wheel/scroll within 140 px of the top) is retained as a
  fallback for keyboard paging and scrollbar drags, but no longer the only path.
- Only the ready labels (`加载更早` / `Load earlier`) are clicked. A button in its
  loading state is never re-clicked, so the shipped button remains the natural
  flow control.

### Fixed

- Wheel velocity was overestimated by roughly 2× because the first sample's
  distance and timestamp were both counted into the window. Normal-scrolling
  readers could be mistaken for fast flicks.

## [0.1.0] — 2026-11-11

- Initial implementation: wheeling or scrolling near the top of the chat
  scrollport dispatches a click on the shipped "Load earlier" button, taking the
  identical code path a human click takes (cancel in-flight work, preserve the
  scroll anchor, pause tail-following).
