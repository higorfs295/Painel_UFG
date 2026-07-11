// Aparição suave ao entrar no viewport (IntersectionObserver). Com reduced-motion o CSS
// mantém tudo visível desde o início — este componente só adiciona a classe.
import { useEffect, useRef } from "react";

type Props = { children: React.ReactNode; className?: string; delay?: number };

export default function Reveal({ children, className = "", delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) { el.classList.add("in"); io.disconnect(); }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
