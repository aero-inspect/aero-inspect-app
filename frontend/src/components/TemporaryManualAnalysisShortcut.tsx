import { Sparkles } from "lucide-react";

// Temporary integration access. Removing this component does not affect report views.
export function TemporaryManualAnalysisShortcut({ onOpen }: { onOpen: () => void }) {
  return <aside className="temporary-analysis-shortcut" aria-label="Herramienta temporal de carga manual"><div><strong>Carga manual temporal</strong><span>Fotos por activo · Prueba de IA</span></div><button className="temporary-analysis-button" type="button" onClick={onOpen}><Sparkles size={16}/> Ejecutar módulo de IA</button></aside>;
}
