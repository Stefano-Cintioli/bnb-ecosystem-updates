# Inputs stay local

Supply the original horizontal BNB Chain SVG at `assets/brand/logos/BNB_Chain_Logo_Yellow.svg` if you have permission to use it. These particular compositions expect its original 319×56 dimensions and nine artwork paths. They use those paths directly; no replacement logo or tracing is supplied.

Supply Inter SemiBold at `assets/brand/fonts/Inter-SemiBold.ttf` for the intro and Inter Bold for the caption examples. Retain the full Inter font license alongside your local font files. Inter is this video's typography choice, not a font identified in the official SVGs. The reduced brand configuration records source fills separately from project layout choices.

The music used in this edit was “Close Up” from Mixkit. The source recording and excerpts are not included. Obtain music under terms appropriate to your own video. The TV on/off sound was original local sound design.

Use your own recordings and original announcement images. Keep an image's source URL and date in your claim registry. An artwork headline can contain a different metric from the narration; give it its own context rather than swapping it onto an unrelated spoken number.

## Assembly example inputs

`case-study/render-episode-v3.py` is the actual episode-specific assembly source from the large-image edit. It is illustrative source and will not run from a clean clone without the local inputs below. Its fixed episode paths are retained to explain the original structure.

- `episodes/2026-10/edit-decision-list-revision03.json`: selected takes, source in/out times, frame counts, timeline positions and local source paths.
- `work/gate-4/revision-03/captions/caption-cues.json`: reviewed phrases, lines and aligned words with section names and timings.
- `episodes/2026-10/claims.json`: source URLs, dates and exact claims.
- `work/gate-4/revision-03/audio-normalization/measurements.json`: measured audio loudness for the selected takes.
- Authorized local fonts, images, recordings and accepted intro/outro files.

These recording-specific files and the private subtitle helpers are deliberately not distributed. Adapt the source to your own inputs. The later 2× and background-blur steps are described separately in the workflow/assembly notes; the v3 example is the earlier composition pass.

## Tools

Use Node 22 or later and the pinned HyperFrames dependency. Check FFmpeg/FFprobe, `libx264`, `libass` and the filters used by a recipe before rendering. Use an existing local browser path for HyperFrames; avoid an automatic browser download or skill installation.

For the project's local HyperFrames calls, update checks, automatic installs, skill installs and telemetry were disabled with `HYPERFRAMES_NO_UPDATE_CHECK=1`, `HYPERFRAMES_NO_AUTO_INSTALL=1`, `HYPERFRAMES_SKIP_SKILLS=1`, `HYPERFRAMES_NO_TELEMETRY=1` and `DO_NOT_TRACK=1`. A reader decides whether to install tools on their own machine.
