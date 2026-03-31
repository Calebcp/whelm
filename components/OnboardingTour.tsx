"use client";

import { motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { getWhelImagePath, type WhelBandanaColor, type WhelPose } from "@/lib/whelm-mascot";
import styles from "@/components/OnboardingTour.module.css";

export type OnboardingTourStep = {
  id: string;
  title: string;
  body: string;
  selector: string;
  pose: WhelPose;
  color: WhelBandanaColor;
  contextPaddingX?: number;
  contextPaddingY?: number;
  mobileContextPaddingX?: number;
  mobileContextPaddingY?: number;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function expandRect(
  rect: SpotlightRect,
  viewport: { width: number; height: number },
  paddingX: number,
  paddingY: number,
): SpotlightRect {
  const left = Math.max(0, rect.left - paddingX);
  const top = Math.max(0, rect.top - paddingY);
  const right = Math.min(viewport.width, rect.left + rect.width + paddingX);
  const bottom = Math.min(viewport.height, rect.top + rect.height + paddingY);

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export default function OnboardingTour({
  open,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
}: {
  open: boolean;
  step: OnboardingTourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 800 });
  const [cardHeight, setCardHeight] = useState(280);
  const cardRef = useRef<HTMLElement | null>(null);
  const maskId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!open) return;

    let frameId: number | null = null;
    const updateRect = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        const targets = Array.from(document.querySelectorAll(step.selector));
        const target = targets.find((node) => {
          if (!(node instanceof HTMLElement)) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (!(target instanceof HTMLElement)) {
          setSpotlightRect(null);
          frameId = null;
          return;
        }
        const rect = target.getBoundingClientRect();
        setSpotlightRect({
          top: Math.max(8, rect.top - 8),
          left: Math.max(8, rect.left - 8),
          width: Math.max(64, rect.width + 16),
          height: Math.max(48, rect.height + 16),
        });
        frameId = null;
      });
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open, step.selector]);

  useEffect(() => {
    if (!open) return;

    const updateViewport = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [open]);

  useEffect(() => {
    if (!open || !cardRef.current) return;

    const element = cardRef.current;
    const updateCardHeight = () => {
      setCardHeight(element.getBoundingClientRect().height || 280);
    };

    updateCardHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateCardHeight);
      return () => window.removeEventListener("resize", updateCardHeight);
    }

    const observer = new ResizeObserver(() => updateCardHeight());
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, step.body, step.title, stepIndex]);

  useEffect(() => {
    if (!open) return;

    const targets = Array.from(document.querySelectorAll(step.selector)).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    targets.forEach((target) => target.setAttribute("data-tour-active", "true"));

    return () => {
      targets.forEach((target) => target.removeAttribute("data-tour-active"));
    };
  }, [open, step.selector]);

  useEffect(() => {
    if (!open) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [open]);

  const contextRect = useMemo(() => {
    if (!spotlightRect) return null;

    const isMobile = viewportSize.width <= 760;
    return expandRect(
      spotlightRect,
      viewportSize,
      isMobile
        ? (step.mobileContextPaddingX ?? 24)
        : (step.contextPaddingX ?? 150),
      isMobile
        ? (step.mobileContextPaddingY ?? 18)
        : (step.contextPaddingY ?? 110),
    );
  }, [
    spotlightRect,
    step.contextPaddingX,
    step.contextPaddingY,
    step.mobileContextPaddingX,
    step.mobileContextPaddingY,
    viewportSize,
  ]);

  const cardPosition = useMemo(() => {
    if (!spotlightRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const viewportWidth = viewportSize.width;
    const viewportHeight = viewportSize.height;
    const isMobile = viewportWidth <= 760;
    const cardWidth = Math.min(420, viewportWidth - (isMobile ? 24 : 32));

    if (isMobile) {
      const safeTop = 18;
      const safeBottom = 16;
      const topCandidate = safeTop;
      const bottomCandidate = Math.max(safeTop, viewportHeight - safeBottom - cardHeight);
      const contextTop = contextRect?.top ?? spotlightRect.top;
      const contextBottom = contextRect ? contextRect.top + contextRect.height : spotlightRect.top + spotlightRect.height;
      const spaceAbove = contextTop - safeTop;
      const spaceBelow = viewportHeight - safeBottom - contextBottom;

      let top = bottomCandidate;
      if (spaceAbove >= cardHeight + 8 && spaceAbove >= spaceBelow) {
        top = topCandidate;
      } else if (spaceBelow >= cardHeight + 8) {
        top = bottomCandidate;
      } else if (spaceAbove > spaceBelow) {
        top = topCandidate;
      }

      return {
        top,
        left: 12,
        transform: "none",
      };
    }

    const prefersBottom = spotlightRect.top < viewportHeight * 0.42;
    let top = prefersBottom
      ? Math.min(viewportHeight - 24 - cardHeight, spotlightRect.top + spotlightRect.height + 16)
      : Math.max(16, spotlightRect.top - (cardHeight + 16));
    const centeredLeft = spotlightRect.left + spotlightRect.width / 2 - cardWidth / 2;
    let left = Math.min(Math.max(16, centeredLeft), viewportWidth - cardWidth - 16);

    const overlapsContext =
      contextRect &&
      left < contextRect.left + contextRect.width &&
      left + cardWidth > contextRect.left &&
      top < contextRect.top + contextRect.height &&
      top + cardHeight > contextRect.top;

    if (overlapsContext && contextRect) {
      const roomRight = viewportWidth - (contextRect.left + contextRect.width) - 16;
      const roomLeft = contextRect.left - 16;
      if (roomRight >= cardWidth) {
        left = viewportWidth - cardWidth - 16;
      } else if (roomLeft >= cardWidth) {
        left = 16;
      } else {
        top = Math.max(16, contextRect.top - (cardHeight + 16));
      }
    }

    return {
      top,
      left,
      transform: "none",
    };
  }, [cardHeight, contextRect, spotlightRect, viewportSize.height, viewportSize.width]);

  if (!open) return null;

  return (
    <div className={styles.tourOverlay} aria-live="polite">
      {contextRect ? (
        <svg
          className={styles.tourMask}
          viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <mask id={maskId}>
              <rect width={viewportSize.width} height={viewportSize.height} fill="white" />
              <rect
                x={contextRect.left}
                y={contextRect.top}
                width={contextRect.width}
                height={contextRect.height}
                rx={viewportSize.width <= 760 ? 26 : 32}
                ry={viewportSize.width <= 760 ? 26 : 32}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width={viewportSize.width}
            height={viewportSize.height}
            className={styles.tourMaskFill}
            mask={`url(#${maskId})`}
          />
        </svg>
      ) : (
        <div
          className={styles.tourScrim}
          style={{
            top: 0,
            left: 0,
            width: viewportSize.width,
            height: viewportSize.height,
          }}
        />
      )}
      {contextRect ? (
        <div
          className={styles.tourContextFrame}
          style={{
            top: contextRect.top,
            left: contextRect.left,
            width: contextRect.width,
            height: contextRect.height,
          }}
        />
      ) : null}
      {spotlightRect ? (
        <motion.div
          className={styles.tourFocus}
          initial={{ opacity: 0.6, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      ) : null}

      <motion.section
        ref={cardRef}
        className={styles.tourCard}
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        style={cardPosition}
      >
        <div className={styles.tourCardTop}>
          <motion.img
            src={getWhelImagePath(step.pose, step.color)}
            alt=""
            aria-hidden="true"
            className={styles.tourMascot}
            animate={{ y: [0, -6, 0], rotate: [0, -2, 2, 0] }}
            transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
          <div className={styles.tourCopy}>
            <p className={styles.tourEyebrow}>Whelm Tour</p>
            <h2 className={styles.tourTitle}>{step.title}</h2>
            <p className={styles.tourBody}>{step.body}</p>
            <p className={styles.tourProgress}>
              Step {stepIndex + 1} of {totalSteps}
            </p>
          </div>
        </div>
        <div className={styles.tourActions}>
          <button type="button" className={styles.tourSecondary} onClick={onSkip}>
            Skip
          </button>
          <button type="button" className={styles.tourPrimary} onClick={onNext}>
            {stepIndex === totalSteps - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </motion.section>
    </div>
  );
}
