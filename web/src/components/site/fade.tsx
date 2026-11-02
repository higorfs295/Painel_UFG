// <Fade> do tremorlabs/template-solar (MIT), em CSS: entra com opacidade, 16 px e um
// desfoque de 4 px, em cascata de 50 ms (o `staggerChildren` do original, que usava a
// biblioteca `motion`). Sem JavaScript e sem IntersectionObserver: termina visível sempre.
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/utils";

const at = (i: number): CSSProperties => ({ animationDelay: `${200 + i * 50}ms` });

export function FadeDiv({ i = 0, className, children }: { i?: number; className?: string; children: ReactNode }) {
  return <div className={cx("fade-in", className)} style={at(i)}>{children}</div>;
}

export function FadeSpan({ i = 0, className, children }: { i?: number; className?: string; children: ReactNode }) {
  return <span className={cx("fade-in inline-block", className)} style={at(i)}>{children}</span>;
}
