import { CheckCircle2 } from "lucide-react";

export function SuccessModal({
  message,
  onGoHome,
  onViewAssets
}: {
  message: string;
  onGoHome: () => void;
  onViewAssets: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="success-modal" role="dialog">
        <div className="success-icon">
          {/* 1. Ajustamos el tamaño a 24 para que encaje en el círculo */}
          <CheckCircle2 size={24} aria-hidden="true" />
        </div>
        <h2>Activo registrado</h2>
        <p>{message}</p>
        <div className="modal-actions">
          {/* 2. Cambiamos la clase al botón secundario */}
          <button className="modal-link-button" onClick={onGoHome} type="button">
            Volver al inicio
          </button>
          {/* 3. Cambiamos la clase al botón principal */}
          <button className="register-button" onClick={onViewAssets} type="button">
            Ver activos
          </button>
        </div>
      </section>
    </div>
  );
}