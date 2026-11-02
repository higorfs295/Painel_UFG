"use client";

// Confete de comemoração (v12) — para marcos de verdade (um marco de horas alcançado, uma
// composição fechada em 100%), nunca para cliques comuns. Canvas temporário, ~1,8 s, sem
// biblioteca. Não roda com `prefers-reduced-motion`.
import { prefersReducedMotion } from "./motion";

type Piece = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string };

function palette(): string[] {
  // a cor de destaque atual + as cores de situação, lidas do CSS (o canvas aceita oklch)
  const cs = getComputedStyle(document.documentElement);
  const pick = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb;
  return [
    pick("--color-brand-500", "#f97316"), pick("--color-brand-300", "#fdba74"),
    pick("--color-emerald-500", "#10b981"), pick("--color-blue-500", "#3b82f6"),
    pick("--color-violet-500", "#8b5cf6"), pick("--color-amber-400", "#fbbf24"),
  ];
}

export function fireConfetti({ x = 0.5, y = 0.35, count = 140 }: { x?: number; y?: number; count?: number } = {}) {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "100" });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  const colors = palette();
  const ox = window.innerWidth * x, oy = window.innerHeight * y;
  const pieces: Piece[] = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2, speed = 4 + Math.random() * 7;
    return {
      x: ox, y: oy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 5,
      w: 5 + Math.random() * 5, h: 8 + Math.random() * 6, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)]!,
    };
  });

  const start = performance.now(), life = 1800;
  const tick = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - t / life);
    for (const p of pieces) {
      p.vy += 0.22; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
      ctx.restore();
    }
    if (t < life) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
