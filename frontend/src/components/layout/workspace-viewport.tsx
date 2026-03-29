"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";

const PEEK = 64; // px of adjacent slide visible above/below
const ANIM_MS = 520; // slower, more deliberate slide transition
const BOUNDARY_THRESHOLD = 220; // requires more scroll force to trigger
const ACCUM_RESET_MS = 500; // longer window — lets momentum build

export interface WorkspaceViewportHandle {
  scrollCurrentToElement: (el: HTMLElement) => void;
}

interface VersionSummary {
  id: string;
  prompt: string;
  acceptedModelLabel?: string | null;
}

interface WorkspaceViewportProps {
  children: React.ReactNode;
  prevVersion: VersionSummary | null;
  nextVersion: VersionSummary | null;
  onSwipePrev: () => void;
  onSwipeNext: () => void;
  disabled?: boolean;
}

export const WorkspaceViewport = forwardRef<WorkspaceViewportHandle, WorkspaceViewportProps>(
  function WorkspaceViewport(
    { children, prevVersion, nextVersion, onSwipePrev, onSwipeNext, disabled },
    ref
  ) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const currentSlideRef = useRef<HTMLDivElement>(null);
    const animatingRef = useRef(false);
    const wheelAccumRef = useRef(0);
    const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [viewportH, setViewportH] = useState(0);
    const [slideOffset, setSlideOffset] = useState(0); // additional Y offset during animation
    const [withTransition, setWithTransition] = useState(false);

    // Expose scroll helper to parent
    useImperativeHandle(ref, () => ({
      scrollCurrentToElement: (el: HTMLElement) => {
        const slide = currentSlideRef.current;
        if (!slide) return;
        const slideRect = slide.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const offset = elRect.top - slideRect.top + slide.scrollTop - 40;
        slide.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
      },
    }));

    // Measure viewport height via ResizeObserver
    useEffect(() => {
      const el = viewportRef.current;
      if (!el) return;
      const obs = new ResizeObserver(() => setViewportH(el.clientHeight));
      obs.observe(el);
      setViewportH(el.clientHeight);
      return () => obs.disconnect();
    }, []);

    const slideH = viewportH > 0 ? Math.max(viewportH - 2 * PEEK, 200) : 600;
    // Base track Y that positions current slide centered with peek above/below:
    // prev occupies [0, slideH], current [slideH, 2*slideH], next [2*slideH, 3*slideH]
    // We want viewport [baseY, baseY + viewportH] to show:
    //   last PEEK px of prev + full current + first PEEK px of next
    // → baseY = slideH - PEEK
    const baseTrackY = -(slideH - PEEK);

    const triggerNavigate = useCallback(
      (direction: "prev" | "next") => {
        if (animatingRef.current || disabled) return;
        const canGo = direction === "next" ? !!nextVersion : !!prevVersion;
        if (!canGo) return;

        animatingRef.current = true;
        wheelAccumRef.current = 0;
        if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);

        // Kick off navigation in parallel so data loads during animation
        if (direction === "next") onSwipeNext();
        else onSwipePrev();

        // Animate track
        const delta = direction === "next" ? -slideH : slideH;
        setWithTransition(true);
        setSlideOffset(delta);

        // After animation: snap back instantly and scroll new slide to top
        setTimeout(() => {
          setWithTransition(false);
          setSlideOffset(0);
          // Reset scroll position so new workspace starts at the top
          if (currentSlideRef.current) {
            currentSlideRef.current.scrollTop = 0;
          }
          setTimeout(() => {
            animatingRef.current = false;
          }, 80);
        }, ANIM_MS);
      },
      [disabled, nextVersion, prevVersion, onSwipeNext, onSwipePrev, slideH]
    );

    // Wheel handler attached directly (passive:false required for preventDefault)
    useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport || viewportH === 0) return;

      const handler = (e: WheelEvent) => {
        // Block all scroll propagation out of the viewport
        e.stopPropagation();

        const slide = currentSlideRef.current;
        if (!slide) return;

        if (animatingRef.current) {
          e.preventDefault();
          return;
        }

        const atTop = slide.scrollTop <= 1;
        const atBottom =
          slide.scrollTop + slide.clientHeight >= slide.scrollHeight - 1;
        const goingDown = e.deltaY > 0;
        const atBoundary = (goingDown && atBottom) || (!goingDown && atTop);

        if (!atBoundary) {
          // Let natural scroll happen within the slide
          return;
        }

        // At boundary: accumulate delta and swipe when threshold reached
        e.preventDefault();

        wheelAccumRef.current += Math.abs(e.deltaY);
        if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);
        wheelResetTimerRef.current = setTimeout(() => {
          wheelAccumRef.current = 0;
        }, ACCUM_RESET_MS);

        if (wheelAccumRef.current >= BOUNDARY_THRESHOLD) {
          wheelAccumRef.current = 0;
          triggerNavigate(goingDown ? "next" : "prev");
        }
      };

      viewport.addEventListener("wheel", handler, { passive: false });
      return () => {
        viewport.removeEventListener("wheel", handler);
        if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);
      };
    }, [viewportH, triggerNavigate]);

    const trackStyle: React.CSSProperties = {
      transform: `translateY(${baseTrackY + slideOffset}px)`,
      transition: withTransition
        ? `transform ${ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
        : "none",
      willChange: "transform",
    };

    return (
      <div
        ref={viewportRef}
        className="relative overflow-hidden flex-1 rounded-panel bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)]"
        style={{ height: "calc(100vh - 88px)" }}
      >
        {/* Slide track */}
        <div style={trackStyle} className="absolute inset-x-0 top-0">
          {/* Prev slide preview */}
          <div
            style={{ height: slideH }}
            className="px-4 flex flex-col justify-end pb-3 pointer-events-none select-none"
          >
            <div
              className="opacity-35 flex flex-col gap-0.5 border-b border-[var(--color-border-tertiary)] pb-3"
            >
              {prevVersion ? (
                <>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                    Previous prompt
                  </span>
                  <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 leading-snug">
                    {prevVersion.prompt || "—"}
                  </p>
                  {prevVersion.acceptedModelLabel && (
                    <span className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                      Accepted: {prevVersion.acceptedModelLabel}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-[var(--color-text-tertiary)] italic">
                  Beginning of history
                </span>
              )}
            </div>
          </div>

          {/* Current slide — scrollable */}
          <div
            ref={currentSlideRef}
            style={{ height: slideH }}
            className="overflow-y-auto overscroll-contain"
          >
            <div className="px-4 py-3 flex flex-col gap-3 min-h-full">
              {children}
            </div>
          </div>

          {/* Next slide preview */}
          <div
            style={{ height: slideH }}
            className="px-4 flex flex-col justify-start pt-3 pointer-events-none select-none"
          >
            <div
              className="opacity-35 flex flex-col gap-0.5 border-t border-[var(--color-border-tertiary)] pt-3"
            >
              {nextVersion ? (
                <>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                    Next prompt
                  </span>
                  <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 leading-snug">
                    {nextVersion.prompt || "—"}
                  </p>
                  {nextVersion.acceptedModelLabel && (
                    <span className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                      Accepted: {nextVersion.acceptedModelLabel}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-[var(--color-text-tertiary)] italic">
                  End of history
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
