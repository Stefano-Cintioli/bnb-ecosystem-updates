# BNB Chain Ecosystem Updates

A look at how I made an English ecosystem video with Grok, Codex, HyperFrames and FFmpeg. I am not a developer. I recorded the footage and reviewed the edits myself.

Grok helped with the research and initial prompt. Codex helped build the local workflow and revise the edit from my feedback. My reported spend on the Codex iterations was under $20.

This repository shares the motion composition source, an episode-specific assembly example, prompts and review templates. It is a case study of a working local edit. You need to supply your own footage, caption inputs and authorized assets; those files are not included.

## The video treatment

1920×1080 at 30 fps. A centered presenter, large original announcement images, consistent ALL CAPS Inter Bold captions and short transitions. The 4.5-second intro and 3-second outro use the original logo paths, a subtle symbol glow and a TV on/off effect. The presenter portion was accelerated to 2× with voice pitch preserved. A later pass added a light background blur and a separate sourced Pasteur card.

## Start here

- [Workflow and review gates](docs/workflow.md)
- [Adapted prompts](docs/prompts.md)
- [Local assets and required inputs](docs/local-assets.md)
- [FFmpeg assembly and 2× recipe](docs/ffmpeg-assembly.md)
- [Script template](templates/script.md), [shot list](templates/shot-list.md), [sign-off](templates/sign-off.md)
- Motion source in `compositions/`; assembly source in `case-study/`.

Requirements: Node 22 or later, HyperFrames pinned to `0.8.114`, FFmpeg/FFprobe with the filters used in the examples, and an existing compatible local Chromium browser for graphics capture. The graphics expect the supplied 319×56 horizontal BNB Chain SVG and the specified Inter font. Read the input notes before running commands.

## Reuse

Keep accepted intro/outro renders and restart each month at script and claims review, Gate 3. The templates support that process. The planned `scripts/new-episode YYYY-MM` command is not implemented in this case-study release.

Footage, renders, transcriptions, music and brand/news asset binaries stay local and out of Git. The source is shared for inspection; this release does not add an open-source license grant. Third-party tools and assets retain their own terms. See [notices](THIRD_PARTY_NOTICES.md).
