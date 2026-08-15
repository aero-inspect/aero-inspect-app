const MAJOR_TICKS: Array<{ angle: number; label: string }> = [
  { angle: 0, label: "N" },
  { angle: 90, label: "E" },
  { angle: 180, label: "S" },
  { angle: 270, label: "O" }
];

const MINOR_TICK_ANGLES = Array.from({ length: 12 }, (_, index) => index * 30).filter(
  (angle) => !MAJOR_TICKS.some((tick) => tick.angle === angle)
);

// Brujula estilo QGroundControl: la rosa (tarjeta) gira por debajo de un
// indicador fijo en la parte superior, mientras el icono del dron permanece
// quieto apuntando siempre "hacia arriba" (referencia del propio vehiculo).
export function Compass({ headingDegree }: { headingDegree: number | null | undefined }) {
  const hasHeading = headingDegree != null && !Number.isNaN(headingDegree);
  const normalizedHeading = hasHeading ? ((headingDegree % 360) + 360) % 360 : 0;

  return (
    <div
      className="qgc-compass"
      role="img"
      aria-label={hasHeading ? `Rumbo ${Math.round(normalizedHeading)} grados` : "Rumbo desconocido"}
    >
      <div className="qgc-compass-readout">{hasHeading ? `${Math.round(normalizedHeading).toString().padStart(3, "0")}°` : "---°"}</div>

      <div className="qgc-compass-dial-frame">
        <svg className="qgc-compass-pointer" viewBox="0 0 16 10" aria-hidden="true">
          <path d="M8 10 L0 0 L16 0 Z" fill="#fbbf24" />
        </svg>

        <div className="qgc-compass-card" style={{ transform: `rotate(${-normalizedHeading}deg)` }}>
          {MINOR_TICK_ANGLES.map((angle) => (
            <span key={angle} className="qgc-tick qgc-tick-minor" style={{ transform: `rotate(${angle}deg)` }} />
          ))}
          {MAJOR_TICKS.map(({ angle, label }) => (
            <span key={angle} className="qgc-tick qgc-tick-major" style={{ transform: `rotate(${angle}deg)` }}>
              <em style={{ transform: `rotate(${-angle}deg)` }}>{label}</em>
            </span>
          ))}
        </div>

        <div className="qgc-compass-vehicle" style={{ opacity: hasHeading ? 1 : 0.4 }}>
          <DroneGlyph size={26} />
        </div>
      </div>
    </div>
  );
}

// Icono de dron visto desde arriba (configuracion en X), reutilizado tanto en
// el centro de la brujula (fijo) como, en su version HTML/SVG plana, en el
// marcador del mapa (rotado segun el rumbo).
export function DroneGlyph({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g stroke="#0a1a38" strokeWidth="1.4" strokeLinecap="round">
        <line x1="16" y1="16" x2="7" y2="7" />
        <line x1="16" y1="16" x2="25" y2="7" />
        <line x1="16" y1="16" x2="7" y2="25" />
        <line x1="16" y1="16" x2="25" y2="25" />
      </g>
      <circle cx="7" cy="7" r="4.2" fill="#18d4aa" stroke="#0a1a38" strokeWidth="1.2" />
      <circle cx="25" cy="7" r="4.2" fill="#18d4aa" stroke="#0a1a38" strokeWidth="1.2" />
      <circle cx="7" cy="25" r="4.2" fill="#8192a5" stroke="#0a1a38" strokeWidth="1.2" />
      <circle cx="25" cy="25" r="4.2" fill="#8192a5" stroke="#0a1a38" strokeWidth="1.2" />
      <rect x="12" y="12" width="8" height="8" rx="2.4" fill="#0a1a38" />
      <path d="M16 2 L20 9 L12 9 Z" fill="#fbbf24" />
    </svg>
  );
}
