import { CheckCircle2 } from "lucide-react";

export function MissionEvidenceModal({
  onClose,
  onViewReports
}: {
  onClose: () => void;
  onViewReports: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="success-modal" role="dialog">
        <div className="success-icon">
          <CheckCircle2 size={24} aria-hidden="true" />
        </div>
        <h2>Mision completada</h2>
        <p>
          La mision termino con exito. Las imagenes ya estan siendo analizadas por la
          Inteligencia Artificial y las podes ver en el modulo de Reportes.
        </p>
        <div className="modal-actions">
          <button className="modal-link-button" onClick={onClose} type="button">
            Cerrar
          </button>
          <button className="register-button" onClick={onViewReports} type="button">
            Ver reportes
          </button>
        </div>
      </section>
    </div>
  );
}
