const MAJOR_TICKS: Array<{ angle: number; label: string }> = [
  { angle: 0, label: "N" },
  { angle: 90, label: "E" },
  { angle: 180, label: "S" },
  { angle: 270, label: "O" }
];

const MINOR_TICK_ANGLES = Array.from({ length: 12 }, (_, index) => index * 30).filter(
  (angle) => !MAJOR_TICKS.some((tick) => tick.angle === angle)
);

// Brujula convencional: la rosa (N/E/S/O y marcas) queda fija y es la aguja
// la que gira para apuntar al rumbo actual, como en una brujula real.
export function Compass({ headingDegree }: { headingDegree: number | null | undefined }) {
  const hasHeading = headingDegree != null && !Number.isNaN(headingDegree);
  const normalizedHeading = hasHeading ? ((headingDegree % 360) + 360) % 360 : 0;

  return (
    <div
      className="qgc-compass"
      role="img"
      aria-label={hasHeading ? `Rumbo ${Math.round(normalizedHeading)} grados` : "Rumbo desconocido"}
    >
      <div className="qgc-compass-readout">{hasHeading ? `${Math.round(normalizedHeading)}°` : "---°"}</div>

      <div className="qgc-compass-dial-frame">
        <div className="qgc-compass-card">
          {MINOR_TICK_ANGLES.map((angle) => (
            <span key={angle} className="qgc-tick qgc-tick-minor" style={{ transform: `rotate(${angle}deg)` }}>
              <em style={{ transform: `rotate(${-angle}deg)` }}>{angle}</em>
            </span>
          ))}
          {MAJOR_TICKS.map(({ angle, label }) => (
            <span key={angle} className="qgc-tick qgc-tick-major" style={{ transform: `rotate(${angle}deg)` }}>
              <em style={{ transform: `rotate(${-angle}deg)` }}>{label}</em>
            </span>
          ))}
        </div>

        <svg
          className="qgc-compass-needle"
          style={{ transform: `rotate(${normalizedHeading}deg)`, opacity: hasHeading ? 1 : 0.35 }}
          viewBox="0 0 32 32"
          aria-hidden="true"
        >
          <path d="M16 11.5 L18 19 L16 17.2 L14 19 Z" fill="#18d4aa" stroke="#0a1a38" strokeWidth="0.65" strokeLinejoin="round" />
        </svg>

        <div className="qgc-compass-hub" />
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
