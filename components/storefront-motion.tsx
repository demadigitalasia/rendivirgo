"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Content stays visible until motion is ready, including without JavaScript. */
export function StorefrontMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector(".storefront");
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = new Set<HTMLElement>();
    const revealAll = () => targets.forEach((target) => target.classList.remove("motion-pending"));
    if (preference.matches || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove("motion-pending");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });

    const enhance = () => {
      root.querySelectorAll<HTMLElement>(".reveal, [data-reveal], .journal-card, .journal-featured").forEach((target) => {
        if (targets.has(target)) return;
        targets.add(target);
        // Never hide content already in view or the element containing keyboard focus.
        if (preference.matches || target.getBoundingClientRect().top < window.innerHeight || target.contains(document.activeElement)) return;
        target.classList.add("motion-pending");
        observer.observe(target);
      });
    };
    enhance();
    // App Router can stream page content after the shared layout has mounted.
    const mutations = new MutationObserver(enhance);
    mutations.observe(root, { childList: true, subtree: true });
    const onPreferenceChange = () => {
      if (preference.matches) {
        revealAll();
        observer.disconnect();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element) event.target.closest(".motion-pending")?.classList.remove("motion-pending");
    };
    preference.addEventListener("change", onPreferenceChange);
    root.addEventListener("focusin", onFocus as EventListener);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      revealAll();
      preference.removeEventListener("change", onPreferenceChange);
      root.removeEventListener("focusin", onFocus as EventListener);
    };
  }, [pathname]);

  return null;
}
