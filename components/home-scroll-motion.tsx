"use client";

import { useEffect } from "react";
import "./home-scroll-motion.css";

/** Small, scroll-linked offsets; content is visible before enhancement runs. */
export function HomeScrollMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".home-page");
    if (!root || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let dispose: (() => void) | undefined;

    const start = () => {
      dispose?.();
      if (preference.matches) return;
      const sections = Array.from(root.querySelectorAll<HTMLElement>(":scope > section, :scope > .home-promises"));
      const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-home-reveal], [data-home-stagger] > *"));
      const visible = new Set<HTMLElement>();
      let frame = 0;
      const paint = () => {
        frame = 0;
        const viewport = window.innerHeight;
        const distance = window.innerWidth <= 720 ? 10 : 22;
        // Read all bounds before writing styles to avoid repeated layout work.
        const positions = Array.from(visible, element => {
          const rect = element.getBoundingClientRect();
          const progress = Math.max(-1, Math.min(1, (viewport / 2 - rect.top - rect.height / 2) / ((viewport + rect.height) / 2)));
          return { element, progress };
        });
        positions.forEach(({ element, progress }) => {
          element.style.setProperty("--home-shift", `${(progress * distance).toFixed(2)}px`);
          element.style.setProperty("--home-copy-shift", `${(progress * distance * -.4).toFixed(2)}px`);
          element.style.setProperty("--home-glow", `${(.45 + (1 - Math.abs(progress)) * .35).toFixed(3)}`);
        });
      };
      const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
      const depthObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) visible.add(element);
          else visible.delete(element);
        });
        schedule();
      });
      sections.forEach(section => depthObserver.observe(section));

      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove("home-motion-pending");
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: .06, rootMargin: "0px 0px -36px 0px" });
      targets.forEach(target => {
        const group = target.parentElement;
        if (group?.hasAttribute("data-home-stagger")) {
          target.style.setProperty("--home-delay", `${Math.min(Array.from(group.children).indexOf(target) * 75, 300)}ms`);
        }
        if (target.getBoundingClientRect().top < window.innerHeight || target.contains(document.activeElement)) return;
        target.classList.add("home-motion-pending");
        revealObserver.observe(target);
      });
      root.dataset.scrollMotion = "ready";
      const focus = (event: FocusEvent) => {
        if (!(event.target instanceof Element)) return;
        let target = event.target.closest(".home-motion-pending");
        while (target) {
          target.classList.remove("home-motion-pending");
          revealObserver.unobserve(target);
          target = target.parentElement?.closest(".home-motion-pending") ?? null;
        }
      };
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      root.addEventListener("focusin", focus);
      dispose = () => {
        cancelAnimationFrame(frame);
        depthObserver.disconnect();
        revealObserver.disconnect();
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        root.removeEventListener("focusin", focus);
        delete root.dataset.scrollMotion;
        targets.forEach(target => {
          target.classList.remove("home-motion-pending");
          target.style.removeProperty("--home-delay");
        });
        sections.forEach(section => {
          ["--home-shift", "--home-copy-shift", "--home-glow"].forEach(property => section.style.removeProperty(property));
        });
      };
    };
    start();
    preference.addEventListener("change", start);
    return () => { dispose?.(); preference.removeEventListener("change", start); };
  }, []);

  return null;
}
