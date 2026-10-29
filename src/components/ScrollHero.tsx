import { Link } from "@tanstack/react-router";
import {
  motion,
  transform,
  useMotionValue,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import posterDesktop from "@/assets/hero/hero-poster-desktop.webp";
import posterMobile from "@/assets/hero/hero-poster-mobile.webp";
import videoDesktop from "@/assets/hero/hero-desktop.mp4?url";
import videoMobile from "@/assets/hero/hero-mobile.mp4?url";

/**
 * Homepage hero: a pinned, scroll-scrubbed film.
 *
 * HOW IT WORKS
 *  - The <section> is several viewports tall and the visuals live in a `sticky` child, so the hero
 *    stays pinned while the page scrolls underneath it. Framer Motion's `useScroll` turns that
 *    scroll distance into a 0→1 `progress`.
 *  - `progress` drives two things: (1) the video's `currentTime` (see the effect below) and (2) the
 *    text "beats" — each beat's opacity/offset is a pure function of `progress` via `useTransform`,
 *    so it all reverses cleanly when the user scrolls back up and costs no React re-renders.
 *  - Beat offsets point the way the picture is moving at that moment: the bottle rises (text exits
 *    up), the hand sweeps in from the left (text enters rightward), the wine pours (text drops in).
 *
 * ASSET CONTRACT (src/assets/hero/ — produced by scripts/encode-hero.sh)
 *  Scrubbing seeks the video on every frame of scrolling, which only feels smooth if seeking is
 *  cheap: a keyframe every few frames, no B-frames, no audio, and no baked-in letterbox bars or
 *  repeated frames. Swap the footage by replacing the four files (same names) and re-running that
 *  script on the new clip. The video is fetched into memory first (see the fetch effect) so
 *  scrubbing never waits on the network.
 *
 * FALLBACKS — the hero never becomes dead scroll:
 *  reduced-motion, Save-Data / 2G, fetch failure, decode error, or a video that never produces a
 *  frame all collapse it to a single static screen: poster + the first beat.
 *
 * PHONES: the clip is landscape, so a full-bleed phone crop would lose either the bottle or the
 * glass. On small screens the footage sits in a framed box with the copy underneath, and
 * `object-position` pans toward the glass for the pour.
 */

/** Scroll runway: the hero is this tall; the film plays across (height − 100svh) of scrolling. */
const RUNWAY = "h-[340svh] md:h-[380svh]";

/** Scrub smoothing time-constant in ms. Lower = snappier, higher = floatier. */
const SMOOTHING_MS = 90;
/** Skip re-seeking for changes smaller than ~half a frame of the 24fps source. */
const MIN_SEEK_STEP = 1 / 48;
/** If the downloaded video still hasn't produced a frame after this long, show the static hero. */
const READY_TIMEOUT_MS = 8000;

// Scroll-linked values below use the FUNCTION form of useTransform (via `transform`) on purpose.
// The array form on a scroll-linked MotionValue opts into Motion's native ScrollTimeline
// acceleration, which in Chrome mapped opacity onto the wrong scroll range (the whole document
// instead of this section) while transforms stayed correct. Function form keeps everything in JS,
// driven by the section's own `offset` range.
const panMap = transform([0, 0.55, 0.95], ["50% 50%", "50% 50%", "88% 50%"]);
const cueMap = transform([0, 0.04], [1, 0]);

type Vec = { x: number; y: number };

type Beat = {
  id: string;
  /** Scroll progress [start, end] over which the beat fades in. Omit = visible from the first frame. */
  in?: [number, number];
  /** Scroll progress [start, end] over which the beat fades out. Omit = stays until the hero ends. */
  out?: [number, number];
  /** Pixels the block travels FROM while fading in / TO while fading out. */
  enter: Vec;
  exit: Vec;
  /** Positioning. Mobile: every beat shares the text slot under the video. md+: free-standing over the footage. */
  anchor: string;
  children: ReactNode;
};

const EYEBROW = "text-[11px] font-medium uppercase tracking-[0.32em] text-accent md:text-xs";
const HEADLINE = "font-display font-black tracking-tight text-balance text-primary-foreground";
// Always the LAST argument to cn(): tailwind-merge treats a font-size class as overriding an earlier
// leading-* (true in Tailwind v3, where text-lg also set line-height), so putting this earlier
// silently drops it and the headline falls back to the 1.5 body line-height.
const LEADING = "leading-[1.05]";
const SUBHEAD = "mt-3 text-[clamp(2rem,8.5vw,2.6rem)] md:text-[clamp(2.2rem,3.1vw,3.4rem)]";
const CTA_PRIMARY =
  "group inline-flex items-center gap-3 rounded-full bg-primary-foreground px-6 py-3.5 text-sm font-bold text-primary transition hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:px-7 md:py-4";
const CTA_SECONDARY =
  "inline-flex items-center gap-2 text-sm text-primary-foreground/80 transition hover:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

// Where the picture is, by progress (0–1 across the 218-frame clip):
//   0.00–0.25 bottle floats and pushes in · 0.30–0.46 a hand sweeps in and grips it
//   0.46–0.70 it turns to the camera · 0.78–1.00 the pour.
// The turn-to-camera stretch is deliberately left without copy — the hand and bottle fill the
// frame there, and it's the moment the footage earns on its own.
const BEATS: Beat[] = [
  {
    id: "intro",
    out: [0.13, 0.24],
    enter: { x: 0, y: 0 },
    exit: { x: 24, y: -52 }, // rises with the bottle
    anchor: "inset-x-6 top-6 md:inset-x-auto md:left-10 md:top-[17svh] md:w-[min(25rem,40vw)]",
    children: (
      <>
        <p className={EYEBROW}>— Curated Selection</p>
        <h1
          className={cn(
            HEADLINE,
            "mt-3 text-[clamp(2.4rem,10.5vw,3.3rem)] md:mt-4 md:text-[clamp(2.75rem,3.9vw,4.4rem)]",
            LEADING,
          )}
        >
          Exceptional bottles, <span className="text-accent">curated.</span>
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 md:mt-8">
          <Link to="/shop" className={CTA_PRIMARY}>
            Shop the collection
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
          <Link to="/about" className={CTA_SECONDARY}>
            Our story <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </>
    ),
  },
  {
    id: "hand",
    in: [0.27, 0.34],
    out: [0.4, 0.47],
    enter: { x: -56, y: 0 }, // follows the hand sweeping in from the left
    exit: { x: 40, y: -32 }, // lifts away as the bottle is raised
    anchor: "inset-x-6 top-6 md:inset-x-auto md:left-10 md:top-[17svh] md:w-[min(25rem,40vw)]",
    children: (
      <>
        <p className={EYEBROW}>— Sourced honestly</p>
        <p className={cn(HEADLINE, SUBHEAD, LEADING)}>Chosen by hand.</p>
        <p className="mt-3 max-w-[22rem] text-sm leading-relaxed text-primary-foreground/80 md:text-base">
          Red, white, rosé and sparkling — delivered across Nigeria.
        </p>
      </>
    ),
  },
  {
    id: "pour",
    in: [0.8, 0.88],
    enter: { x: 0, y: -40 }, // drops in like the pour
    exit: { x: 0, y: 0 },
    anchor:
      "inset-x-6 top-6 md:inset-x-auto md:top-auto md:bottom-[7svh] md:left-10 md:w-[min(34rem,40vw)]",
    children: (
      <>
        <p className={EYEBROW}>— Same-day–next-day delivery</p>
        <p className={cn(HEADLINE, SUBHEAD, LEADING)}>Ready to pour.</p>
        <div className="mt-5 md:mt-6">
          <Link to="/shop" className={CTA_PRIMARY}>
            Shop the collection
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </>
    ),
  },
];

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

export function ScrollHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Deliberately not Motion's useReducedMotion(): that reads the media query synchronously during
  // the client's first render, which differs from the server's render. React keeps the server's
  // attributes through hydration, so reduced-motion users ended up with the server's tall section
  // but a client that believed it was static — dead scroll. State set in an effect starts equal to
  // the server render and then updates normally (the CSS `motion-reduce:` class covers the gap).
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const [fallback, setFallback] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const staticMode = !!prefersReducedMotion || fallback;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  // In static mode the section is one screen tall (no scroll distance to measure), so progress is pinned at 0.
  const idle = useMotionValue(0);
  const progress = staticMode ? idle : scrollYProgress;

  // Phones: pan the crop toward the glass for the pour. A no-op wherever the whole frame fits (desktop).
  const objectPosition = useTransform(progress, panMap);
  const cueOpacity = useTransform(progress, cueMap);

  // 1) Pull the film into memory. Scrubbing seeks constantly; against a streamed <video src> every
  //    seek outside the buffered range waits on the network (and needs range-request support).
  //    The file is ~1.4–3 MB, so we fetch it whole, hand it over as a blob URL, and only start
  //    scrubbing once it's fully local. The poster covers the wait.
  useEffect(() => {
    if (staticMode) return;
    // The reduced-motion state above lands a render AFTER this effect first runs, so ask the media
    // query directly — otherwise those users would start (then abort) the download.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Data-saver / 2G users get the static hero rather than a multi-MB download.
    const net = (navigator as Navigator & { connection?: NetworkInfo }).connection;
    if (net?.saveData || (net?.effectiveType && /(^|-)2g$/.test(net.effectiveType))) {
      setFallback(true);
      return;
    }

    // Read the breakpoint directly rather than via useIsMobile(): that hook reports "desktop"
    // on first render and corrects after mount, which would download the wrong file on phones.
    const src = window.matchMedia("(min-width: 768px)").matches ? videoDesktop : videoMobile;

    const controller = new AbortController();
    let objectUrl: string | undefined;
    fetch(src, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Hero video request failed (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        // Explicit type: some hosts serve media as application/octet-stream, which Safari rejects for blobs.
        objectUrl = URL.createObjectURL(new Blob([buffer], { type: "video/mp4" }));
        setVideoUrl(objectUrl);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn(err);
        setFallback(true);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [staticMode]);

  // Safety net: bytes arrived but the element never produced a frame (codec/autoplay-policy quirks).
  useEffect(() => {
    if (!videoUrl || ready) return;
    const id = window.setTimeout(() => setFallback(true), READY_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [videoUrl, ready]);

  // 2) Scrub. Event-driven: a frame loop runs only while the picture still has to catch up with the
  //    scroll position, then stops — a hero that's idle (or off-screen) costs nothing.
  useEffect(() => {
    const video = videoRef.current;
    if (!ready || !video) return;

    const s = { raf: 0, last: 0, current: progress.get(), lastSeek: -1 };

    const tick = (now: number) => {
      s.raf = 0;
      if (!Number.isFinite(video.duration)) return;

      // rAF's timestamp can sit a hair before the performance.now() taken at kick(): never step backwards.
      const dt = Math.max(0, Math.min(64, now - s.last));
      s.last = now;

      // Frame-rate-independent exponential smoothing toward the real scroll position.
      const target = progress.get();
      s.current += (target - s.current) * (1 - Math.exp(-dt / SMOOTHING_MS));
      if (Math.abs(target - s.current) < 0.0003) s.current = target;

      const time = Math.min(video.duration - 0.001, Math.max(0, s.current * video.duration));
      // One seek in flight at a time: queueing seeks is what makes scrubbed video stutter.
      if (!video.seeking && Math.abs(time - s.lastSeek) >= MIN_SEEK_STEP) {
        video.currentTime = time;
        s.lastSeek = time;
      }

      if (s.current !== target || Math.abs(time - s.lastSeek) >= MIN_SEEK_STEP) {
        s.raf = requestAnimationFrame(tick);
      }
    };

    const kick = () => {
      if (s.raf) return;
      s.last = performance.now();
      s.raf = requestAnimationFrame(tick);
    };

    kick(); // snap to the current scroll position (e.g. page reloaded mid-hero)
    const unsubscribe = progress.on("change", kick);
    return () => {
      unsubscribe();
      cancelAnimationFrame(s.raf);
    };
  }, [ready, progress]);

  return (
    <section
      ref={sectionRef}
      data-dark-hero // lets the Navbar keep its light-on-dark tone while this is behind it
      aria-label="Finkel Reserve"
      className={cn("relative bg-hero-ink motion-reduce:h-svh!", staticMode ? "h-svh" : RUNWAY)}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Footage. md+: full-bleed. Phones: a framed box on top whose lower edge melts into the page colour. */}
        <div className="absolute inset-x-0 top-0 h-[58svh] [-webkit-mask-image:linear-gradient(to_bottom,#000_80%,transparent)] [mask-image:linear-gradient(to_bottom,#000_80%,transparent)] md:inset-0 md:h-auto md:[-webkit-mask-image:none] md:[mask-image:none]">
          <picture>
            <source media="(min-width: 768px)" srcSet={posterDesktop} />
            <motion.img
              src={posterMobile}
              alt=""
              fetchPriority="high"
              decoding="async"
              style={{ objectPosition }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
          {videoUrl && !staticMode && (
            <motion.video
              ref={videoRef}
              src={videoUrl}
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              aria-hidden
              tabIndex={-1}
              onLoadedData={() => setReady(true)}
              onError={() => setFallback(true)}
              style={{ objectPosition }}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                ready ? "opacity-100" : "opacity-0",
              )}
            />
          )}
        </div>

        {/* Legibility scrims for the free-standing desktop copy (phones put copy on solid colour). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-40 bg-gradient-to-b from-hero-ink/70 to-transparent md:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[40%] bg-gradient-to-t from-hero-ink/75 via-hero-ink/25 to-transparent md:block"
        />

        {/* Copy */}
        <div className="absolute inset-x-0 bottom-0 h-[42svh] md:inset-0 md:h-auto">
          <div className="relative mx-auto h-full max-w-[1400px]">
            {BEATS.map((beat) => (
              <BeatView key={beat.id} beat={beat} progress={progress} />
            ))}
          </div>
        </div>

        <motion.div
          aria-hidden
          style={{ opacity: cueOpacity }}
          className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-primary-foreground/70">
            Scroll
          </span>
          <span className="h-8 w-px bg-primary-foreground/40" />
        </motion.div>
      </div>
    </section>
  );
}

/** One block of copy whose visibility and travel are functions of hero progress. */
function BeatView({ beat, progress }: { beat: Beat; progress: MotionValue<number> }) {
  const maps = useMemo(() => {
    const input: number[] = [];
    const opacity: number[] = [];
    const x: number[] = [];
    const y: number[] = [];
    if (beat.in) {
      input.push(...beat.in);
      opacity.push(0, 1);
      x.push(beat.enter.x, 0);
      y.push(beat.enter.y, 0);
    } else {
      input.push(0);
      opacity.push(1);
      x.push(0);
      y.push(0);
    }
    if (beat.out) {
      input.push(...beat.out);
      opacity.push(1, 0);
      x.push(0, beat.exit.x);
      y.push(0, beat.exit.y);
    } else {
      input.push(1);
      opacity.push(1);
      x.push(0);
      y.push(0);
    }
    return {
      opacity: transform(input, opacity),
      x: transform(input, x),
      y: transform(input, y),
    };
  }, [beat]);

  const opacity = useTransform(progress, maps.opacity);
  const x = useTransform(progress, maps.x);
  const y = useTransform(progress, maps.y);
  // Fully faded beats leave the tab order and the accessibility tree, so keyboard and screen-reader
  // users never land on a link they can't see.
  const visibility = useTransform(
    opacity,
    (o) => (o < 0.01 ? "hidden" : "visible") as "hidden" | "visible",
  );

  return (
    <motion.div
      style={{ opacity, x, y, visibility }}
      className={cn("absolute isolate", beat.anchor)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-12 -inset-y-10 -z-10 hidden bg-[radial-gradient(closest-side,oklch(0.14_0.03_30/0.6),transparent)] md:block"
      />
      {beat.children}
    </motion.div>
  );
}
