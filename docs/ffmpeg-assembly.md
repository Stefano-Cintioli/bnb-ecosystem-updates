# FFmpeg assembly and speed changes

The working edit used separate image/video composition and reviewed PCM audio. It reused accepted intro/outro video packets and assembled the matching audio once for delivery. The episode-specific source is in `case-study/render-episode-v3.py`.

The following is a recipe adapted from the tested 2× derivative. It assumes already composed 1920×1080 body video at exactly 30 fps, matching reviewed 48 kHz stereo audio and compatible normal-speed bookends. Supply your own inputs and verify their properties; these files are not shipped.

## Accelerate the body

Count the body's actual frames first. For a body of N frames, selecting every second frame gives ceil(N/2) output frames. Its output duration is that count divided by 30. An odd frame count requires rounding to the 30 fps grid.

The video filter used was:

```text
select=not(mod(n\,2)),setpts=N/(30*TB)
```

For an already isolated body, an illustrative video command is:

```sh
ffmpeg -hide_banner -n -i body.mp4 -an \
  -vf 'select=not(mod(n\,2)),setpts=N/(30*TB)' \
  -r 30 -fps_mode cfr -c:v libx264 -preset fast -crf 16 \
  -profile:v high -level:v 4.1 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -video_track_timescale 15360 -map_metadata -1 \
  -movflags +faststart body-fast.mp4
```

The matching audio uses `atempo=2`, which changes tempo while preserving voice pitch:

```sh
ffmpeg -hide_banner -n -i body.wav -vn -af 'atempo=2,asetpts=PTS-STARTPTS' \
  -c:a pcm_f32le -ar 48000 -ac 2 body-fast-unpadded.wav
```

Measure the actual resulting sample count. The target is output_body_frames × 1600 sample frames, because 48000/30 = 1600. The tempo algorithm can differ slightly from the mathematical half duration. In the tested edit, compensation added 28 ms of silence at an already quiet end; no speech was trimmed.

Before any duration adjustment, check that an overhang is silent and that any shortage is small and expected. The working runner stopped for more than 4000 missing sample frames, or an overhang whose absolute PCM amplitude exceeded 0.001. Do not trim an audible final word to meet a frame count. After the guard passes, use `apad=whole_len=TARGET,atrim=end_sample=TARGET,asetpts=PTS-STARTPTS` with your measured target.

Burned captions and image holds accelerate with the picture. This intentionally doubles caption reading speed. It is not a pass against the earlier normal-speed caption limit; review a short preview at the requested pace.

## Assemble normal-speed bookends

Create an FFconcat list containing the accepted intro, accelerated body and accepted outro, with each exact frame-derived duration. Keep a separate audio list with their matching reviewed PCM waveforms. Use paths quoted according to the FFconcat file format; ordinary shell quoting is not the same format.

The final mux used separate audio/video lists with these options:

```text
-copyts
-f concat -safe 0 -i video-concat.txt
-f concat -safe 0 -i audio-concat.txt
-map 0:v:0 -map 1:a:0
-c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2
-frames:v TOTAL_FRAMES -t EXACT_SECONDS
-avoid_negative_ts disabled -use_editlist 1
-movie_timescale 48000 -video_track_timescale 15360
-map_metadata -1 -write_tmcd 0 -movflags +faststart
```

Use your actual total frame count and exact duration. The 48 kHz movie clock avoided a sub-millisecond audio edit-list rounding issue in the tested odd-length output. Stream copying requires compatible video parameters; verify them rather than assume. Also inspect colour tags on copied bookends. In the later tested revision, those graphics lacked H.264 primaries and transfer tags. A lossless bitstream remux used `h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0`, preserving all decoded pictures and audio packets while declaring limited-range BT.709 throughout. The filter option uses the spelling `colour_primaries`; check your installed filter help before running it.

## Background blur and a separate card

The later revision selected the same 2× source frames first, generated local person masks for each take and softened the room before applying the original captions and images. The native blur source is in `case-study/person-blur-bt709.swift`. It requires Apple's installed Vision and Core Image frameworks on a compatible Mac. It accepts local input, output and mask directories; no footage or model is distributed here. Use distinct, empty output and mask directories, because an existing same-named PNG can be replaced. Feed clean presenter frames to the helper before adding captions or announcement images; it does not separate those layers from a finished video. Its final log about unchanged subtitles refers to that later composition order. The foreground uses an inferred person mask, so review moving edges rather than assume they are perfect. It also writes a diagnostic `round-trip.png`; exclude that file from the video frame sequence.

Keep the input/output colour space consistent. The first sRGB output introduced a colour shift; explicitly using native ITUR_709 fixed it. Review a no-filter colour round trip and actual moving hair/glasses/hand edges before processing a whole edit.

A new three-second Pasteur artwork card was inserted after the BSC passage, with its own observed BidBlock V2 versus Bid V1 gas-per-block context. The previous 70M screenshot was removed. The card uses 90 frames and 144000 silent stereo sample frames; the original speech remains unchanged. Its transition handles must come from the same blurred footage so the room does not briefly sharpen.

## Verify the actual output

Check actual decoded frame count, 30 fps timestamps, stream start times and equal exact durations. Compare accepted intro/outro frames, inspect every recording join and image transition, confirm caption wording and all sensitive numbers, and measure the encoded audio peak. Listen to the delivered video and judge pacing. A syntax check alone does not verify a render.
