# making 005

- `search.py` enumerates symmetric treble-dodging Minor methods (lead end 12 or 16), keeps the ones with a true plain course, and scores them for music. 4,922 came out true, and the scores tied in huge blocks. A score can't hear, so the page rings Cambridge instead. Kept as a record of the detour.
- `touches.py` finds short true touches of Plain Bob Minor. The page uses 72 with bobs at the 3rd and 6th leads (PPBPPB).
- `uitest.mjs` rings the 3rd like a person: it reads the page's clock and presses space (or taps the tower with `MOBILE=1 W=390 H=844`) at each blow, missing two on purpose. Then it checks the board, standing early, follow mode, reload, and the two-click wipe. `ONLY1=1` runs just the first part.
- The sound is checked with `../../tools/harness.mjs audio`, which now uses the page's `window.__offlineRender`. Pass `?touch=` in `FILM` to choose the touch.
