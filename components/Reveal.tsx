"use client";
import { useEffect } from "react";

// Adds .in to every .reveal element once it scrolls into view.
export default function Reveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    els.forEach((e) => io.observe(e));
    const safety = setTimeout(() => els.forEach((e) => e.classList.add("in")), 4000);
    return () => { io.disconnect(); clearTimeout(safety); };
  }, []);
  return null;
}
