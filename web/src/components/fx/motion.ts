"use client";

// Utilidades de movimento compartilhadas pelos grafismos (v12). Tudo respeita
// `prefers-reduced-motion`: quem pediu menos movimento vê o estado final direto.
import { useEffect, useState } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Interpola de `from` até `to` em `duration` ms (ease-out cúbico). */
export function useTween(to: number, duration = 900) {
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(to); return; }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return value;
}
