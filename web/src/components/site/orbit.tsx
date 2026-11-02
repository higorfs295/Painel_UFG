// Órbita — Orbit do tremorlabs/template-solar (MIT): objetos girando em torno de um
// centro, opcionalmente mantidos de pé. Só CSS (`animation: spin`).
export function Orbit({ radiusPx = 144, children, orbitingObjects = [], defaultObjectSize = 32, durationSeconds = 8, keepUpright = false }: {
  radiusPx?: number; children: React.ReactNode; orbitingObjects: React.ReactNode[];
  defaultObjectSize?: number; durationSeconds?: number; keepUpright?: boolean;
}) {
  const orbitDiameter = radiusPx * 2;
  const containerSize = orbitDiameter + defaultObjectSize;
  const initialOffset = radiusPx + defaultObjectSize / 2;
  const spin = (delay: number, reverse?: boolean): React.CSSProperties => ({
    animationName: "spin", animationDuration: `${durationSeconds}s`, animationTimingFunction: "linear",
    animationIterationCount: "infinite", animationDelay: `${delay}s`, animationDirection: reverse ? "reverse" : undefined,
  });

  return (
    <div className="relative flex items-center justify-center" style={{ width: containerSize, height: containerSize }}>
      <div className="absolute animate-pulse rounded-full border border-gray-300 bg-gray-500/5" style={{ width: orbitDiameter, height: orbitDiameter }} />
      {orbitingObjects.map((object, index) => {
        const delay = -(index * (durationSeconds / orbitingObjects.length));
        return (
          <div key={index} className="absolute flex items-center justify-center"
            style={{
              ...spin(delay), transformOrigin: `calc(50% + ${radiusPx}px) 50%`,
              left: `calc(50% - ${initialOffset}px)`, top: `calc(50% - ${defaultObjectSize / 2}px)`,
              width: defaultObjectSize, height: defaultObjectSize,
            }}>
            <div className="flex h-full w-full items-center justify-center" style={keepUpright ? spin(delay, true) : undefined}>
              {object}
            </div>
          </div>
        );
      })}
      {children}
    </div>
  );
}
