#!/usr/bin/env bash
# encode-hero.sh — prepare a clip for scroll-scrubbed playback (video.currentTime driven by scroll).
#
# Why this exists
#   A normal web-export MP4 has a keyframe every few seconds (wine_hero.mp4 had exactly two in 9.1s).
#   Seeking to an arbitrary time then forces the browser to decode every frame since the previous
#   keyframe, which is what makes scroll-scrubbed video stutter. These renditions use a keyframe every
#   few frames, no B-frames and no audio, so any seek costs at most a handful of frame decodes.
#
# Usage
#   bash encode-hero.sh <input.mp4> <output-dir> [W:H:X:Y]
#
#   W:H:X:Y  the real picture area inside the source frame. The default is for wine_hero.mp4, which has
#            black bars baked in that CHANGE size at frame 122 (picture goes from 1440x899 to an inset
#            1423x889). The default is the intersection of both with a few px of margin, so no bar can
#            show in any frame. Re-measure for any new clip.
#
#   Env: PRESET (default medium) · GOP (default 4) · FPS (default 24)
#        DEDUPE=0 skips duplicate-frame removal (do this for a new clip until you've calibrated it)
set -euo pipefail

IN="${1:?usage: bash encode-hero.sh <input.mp4> <output-dir> [W:H:X:Y]}"
OUT="${2:?usage: bash encode-hero.sh <input.mp4> <output-dir> [W:H:X:Y]}"
CROP="${3:-1416:880:16:70}"
PRESET="${PRESET:-medium}"
GOP="${GOP:-4}"
FPS="${FPS:-24}"

mkdir -p "$OUT"

# 1) crop away the baked-in borders
# 2) drop held duplicate frames. wine_hero.mp4 was frame-rate converted 24->30fps, so ~1 frame in 5 is a
#    repeat (54 of 273). A repeated frame is a visible hitch while scrubbing.
#    The mpdecimate thresholds below were CALIBRATED on this clip against a pixel-diff census of its 54
#    repeats: they catch all 54 and also drop 1 near-static real frame (#209), which is harmless. Looser
#    values (mpdecimate defaults) drop 2 real frames; tighter ones (hi=64) quietly miss repeats or drop
#    nothing at all. For any other clip, compare the frame counts printed at the end before trusting it.
# 3) retime to a constant ${FPS}fps so scroll progress maps linearly onto frame index
if [ "${DEDUPE:-1}" = "1" ]; then DD="mpdecimate=hi=128:lo=64:frac=0.05,"; else DD=""; fi
PREP="crop=${CROP},${DD}setpts=N/(${FPS}*TB)"

encode() { # encode <name> <width> <crf>
  ffmpeg -v error -y -i "$IN" -an \
    -vf "${PREP},scale=${2}:-2:flags=lanczos,format=yuv420p" \
    -r "$FPS" -c:v libx264 -preset "$PRESET" -crf "$3" -profile:v high \
    -g "$GOP" -keyint_min "$GOP" -sc_threshold 0 -bf 0 \
    -movflags +faststart "$OUT/${1}.mp4"
}

poster() { # poster <name> <width>  — frame 0 through the same crop/scale, shown while the video loads
  ffmpeg -v error -y -i "$IN" -vf "crop=${CROP},scale=${2}:-2:flags=lanczos" -frames:v 1 \
    -c:v libwebp -quality 80 "$OUT/${1}.webp"
}

count() { ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$1"; }

encode hero-desktop 1416 23
encode hero-mobile   960 25
poster hero-poster-desktop 1416
poster hero-poster-mobile   960

echo "frames: $(count "$IN") in -> $(count "$OUT/hero-desktop.mp4") out  (-> $OUT)"
