import type { AiDeformationReport } from "../api/types";

// La detección de deformaciones está desactivada: el módulo de IA ya no corre ese modelo
// (AEROINSPECT_DEFORMATION_ENABLED, apagado por default) y el frontend muestra siempre "sin
// deformaciones detectadas", incluso para las fotos analizadas antes con el modelo prendido.
// Para volver a mostrar lo que informe la IA, pasar esto a false.
export const DEFORMATION_DETECTION_DISABLED = true;

export const NO_DEFORMATION_REPORT: AiDeformationReport = {
  status: "no_deformation_detected",
  detected_area_percent: 0,
  overlay_url: null,
};

/** El reporte de deformaciones a mostrar para una foto ya analizada. */
export function displayedDeformation(report: AiDeformationReport | null | undefined): AiDeformationReport | null {
  if (DEFORMATION_DETECTION_DISABLED) return NO_DEFORMATION_REPORT;
  return report ?? null;
}
