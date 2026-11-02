// Chip pulsante — ChipViz do tremorlabs/template-solar (MIT). O original animava as
// camadas com `motion`; aqui é a mesma pulsação (escala 1 → 1,1 → 1 a cada 4 s, em
// cascata) com CSS (`@keyframes chipPulse` em globals.css).
import { BrandMark } from "@/components/brand";

const pulse = (scale: number, delay: number): React.CSSProperties => ({
  // @ts-expect-error variável CSS lida pela keyframe
  "--pulse": scale,
  animation: `chipPulse 4s cubic-bezier(0.23, 1, 0.32, 1) ${delay}s infinite`,
});

export function ChipViz() {
  return (
    <div className="relative flex items-center">
      <div className="relative">
        <div style={pulse(1.1, 0)} className="absolute -inset-px z-0 rounded-full bg-linear-to-r from-yellow-500 via-amber-500 to-orange-500 opacity-30 blur-xl" />
        <div style={pulse(1.08, 0.1)} className="relative z-0 min-h-[80px] min-w-[80px] rounded-full border bg-linear-to-b from-white to-orange-50 shadow-xl shadow-orange-500/20">
          <div style={pulse(1.06, 0.2)} className="absolute inset-1 rounded-full bg-linear-to-t from-yellow-500 via-amber-500 to-orange-500 p-0.5 shadow-xl">
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/40 shadow-xs shadow-white/40">
              <div className="size-full bg-black/30" />
              <div style={pulse(1.04, 0.3)} className="absolute inset-0 rounded-full bg-linear-to-t from-yellow-500 via-amber-500 to-orange-500 opacity-50 shadow-[inset_0_0_16px_4px_rgba(0,0,0,1)]" />
              <div style={pulse(1.02, 0.4)} className="absolute inset-[6px] rounded-full bg-white/10 p-1 backdrop-blur-[1px]">
                <div className="relative flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-white to-gray-300 shadow-lg shadow-black/40">
                  <BrandMark className="size-6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
