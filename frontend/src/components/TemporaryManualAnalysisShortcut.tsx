import { Sparkles } from "lucide-react";

// Temporary integration access. Removing this component does not affect report views.
export function TemporaryManualAnalysisShortcut({ onOpen }: { onOpen: () => void }) {
  return <aside className="temporary-analysis-shortcut" aria-label="Herramienta temporal de carga manual"><div><strong>Carga manual temporal</strong><span>Asignación de fotos y ejecución de IA para probar inspecciones.</span></div><button className="reports-ai-button" type="button" onClick={onOpen}><Sparkles size={16}/> Ejecutar módulo de IA</button></aside>;
}
