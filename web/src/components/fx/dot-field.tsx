"use client";

// Campo de pontos vivo — o "Jogo da Vida" do HeroBackground do tremorlabs/template-solar
// (MIT), adaptado para as faixas de topo do app (v12): fundo transparente, pontos na cor do
// texto do elemento (então seguem o destaque e o tema), canvas menor. Com
// `prefers-reduced-motion` desenha um quadro e para; fora da tela ou com a aba oculta, pausa.
import { useEffect, useRef } from "react";
import { cx } from "@/lib/utils";

type Cell = { alive: boolean; opacity: number };

export function DotField({ className, width = 720, height = 240, cell = 8, density = 0.82 }: {
  className?: string; width?: number; height?: number; cell?: number; density?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cols = Math.floor(width / cell), rows = Math.floor(height / cell);
    let grid: Cell[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => {
        const alive = Math.random() > density;
        return { alive, opacity: alive ? 0.6 : 0 };
      }));
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined, visible = true;

    const neighbors = (x: number, y: number) => {
      let n = 0;
      for (let i = -1; i < 2; i++) for (let j = -1; j < 2; j++)
        if ((i || j) && grid[(x + i + rows) % rows]![(y + j + cols) % cols]!.alive) n++;
      return n;
    };

    const draw = () => {
      const color = getComputedStyle(canvas).color || "rgb(0,0,0)";
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const c = grid[i]![j]!;
        if (c.alive && c.opacity < 0.85) c.opacity = Math.min(c.opacity + 0.2, 0.85);
        else if (!c.alive && c.opacity > 0) c.opacity = Math.max(c.opacity - 0.2, 0);
        if (c.opacity > 0) {
          ctx.globalAlpha = c.opacity;
          ctx.beginPath();
          ctx.arc(j * cell + cell / 2, i * cell + cell / 2, 1.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      grid = grid.map((row, i) => row.map((c, j) => {
        const n = neighbors(i, j);
        return { alive: c.alive ? n === 2 || n === 3 : n === 3, opacity: c.opacity };
      }));
      // reaviva o campo quando ele "morre" (o Jogo da Vida estabiliza com o tempo)
      if (Math.random() < 0.04) for (let k = 0; k < 18; k++) {
        const r = grid[Math.floor(Math.random() * rows)]!, cIdx = Math.floor(Math.random() * cols);
        r[cIdx] = { alive: true, opacity: r[cIdx]!.opacity };
      }
      if (reduce || !visible || document.hidden) return;
      timer = setTimeout(() => { frame = requestAnimationFrame(draw); }, 140);
    };

    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = !!e?.isIntersecting;
      if (visible && !was && !reduce) draw();
    });
    const onVis = () => { if (!document.hidden && visible && !reduce) { clearTimeout(timer); draw(); } };
    io.observe(canvas);
    document.addEventListener("visibilitychange", onVis);
    draw();
    return () => {
      io.disconnect(); document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(frame); if (timer) clearTimeout(timer);
    };
  }, [width, height, cell, density]);

  return <canvas ref={ref} width={width} height={height} aria-hidden="true" className={cx("pointer-events-none select-none", className)} />;
}
