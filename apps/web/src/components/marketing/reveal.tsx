"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion";

/**
 * Section reveal (spec 11): content is fully visible in the server HTML. After hydration,
 * and only for elements that start below the fold, it is set to a hidden pose and animated in
 * when it scrolls into view (opacity + 14px translate, 450ms). Reduced motion, a missing
 * IntersectionObserver, or any failure leaves the content visible. A timer reveals it anyway
 * if the observer never fires.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!("IntersectionObserver" in window)) return;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already in view: no entrance
      el.style.opacity = "0";
      el.style.transform = "translateY(14px)";
      let done = false;
      const show = () => {
        if (done) return;
        done = true;
        io.disconnect();
        clearTimeout(failsafe);
        try {
          animate(
            el,
            { opacity: 1, transform: "translateY(0px)" },
            { duration: 0.45, delay, ease: [0.2, 0.7, 0.2, 1] },
          ).then(() => {
            el.style.opacity = "";
            el.style.transform = "";
          });
        } catch {
          el.style.opacity = "";
          el.style.transform = "";
        }
      };
      const io = new IntersectionObserver(
        (entries) => entries.some((e) => e.isIntersecting) && show(),
        { rootMargin: "0px 0px -8% 0px" },
      );
      io.observe(el);
      const failsafe = setTimeout(() => {
        // never leave content hidden: if the page was left idle offscreen, reveal after 8 s
        if (!document.hidden) show();
      }, 8000);
      return () => {
        io.disconnect();
        clearTimeout(failsafe);
        el.style.opacity = "";
        el.style.transform = "";
      };
    } catch {
      el.style.opacity = "";
      el.style.transform = "";
    }
  }, [delay]);
  const T = Tag as React.ElementType;
  return (
    <T ref={ref} className={className}>
      {children}
    </T>
  );
}
