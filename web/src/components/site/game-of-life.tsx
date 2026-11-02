"use client";

// Fundo do herói: o "Jogo da Vida" de Conway em pontos — HeroBackground do tremorlabs/
// template-solar (MIT). Mesmo canvas (1500×600, células de 6 px, transição de opacidade).
// Painel: com `prefers-reduced-motion` desenha um quadro e para; fora da tela, pausa.
import { useEffect, useRef } from "react";

type Grid = { alive: boolean; opacity: number }[][];

export function GameOfLife() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined, visible = true;
    const cellSize = 6;
    const cols = Math.floor(canvas.width / cellSize);
    const rows = Math.floor(canvas.height / cellSize);
    const transitionSpeed = 0.2;

    let grid: Grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ alive: Math.random() > 0.85, opacity: Math.random() > 0.85 ? 0.5 : 0 })));

    const neighbors = (g: Grid, x: number, y: number) => {
      let sum = 0;
      for (let i = -1; i < 2; i++) for (let j = -1; j < 2; j++) {
        sum += g[(x + i + rows) % rows]![(y + j + cols) % cols]!.alive ? 1 : 0;
      }
      return sum - (g[x]![y]!.alive ? 1 : 0);
    };

    const draw = () => {
      ctx.fillStyle = "#f9fafb"; // gray-50, o fundo do site
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const cell = grid[i]![j]!;
        if (cell.alive && cell.opacity < 1) cell.opacity = Math.min(cell.opacity + transitionSpeed, 0.5);
        else if (!cell.alive && cell.opacity > 0) cell.opacity = Math.max(cell.opacity - transitionSpeed, 0);
        if (cell.opacity > 0) {
          ctx.fillStyle = `rgba(0, 0, 0, ${cell.opacity})`;
          ctx.beginPath();
          ctx.arc(j * cellSize + cellSize / 2, i * cellSize + cellSize / 2, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      grid = grid.map((row, i) => row.map((cell, j) => {
        const n = neighbors(grid, i, j);
        return { alive: cell.alive ? n >= 2 && n <= 3 : n === 3, opacity: cell.opacity };
      }));
      if (reduce || !visible) return;
      timer = setTimeout(() => { frame = requestAnimationFrame(draw); }, 125);
    };

    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = !!e?.isIntersecting;
      if (visible && !was && !reduce) draw();
    });
    io.observe(canvas);
    draw();
    return () => { io.disconnect(); cancelAnimationFrame(frame); if (timer) clearTimeout(timer); };
  }, []);

  return (
    <div className="mask pointer-events-none overflow-hidden select-none" aria-hidden="true">
      <canvas ref={canvasRef} width={1500} height={600} />
    </div>
  );
}
