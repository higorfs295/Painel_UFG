// Conta de 0 até `value` com easing (flourish dos dashboards de referência — NovaPay/Quantix).
// Respeita prefers-reduced-motion: nesse caso entrega o valor final de imediato.
import { useEffect, useRef, useState } from "react";

export function useCountUp(value: number, durationMs = 900): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === value) { setShown(value); fromRef.current = value; return; }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setShown(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return shown;
}
