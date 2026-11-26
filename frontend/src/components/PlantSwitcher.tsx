import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Factory } from "lucide-react";
import type { Plant } from "../types";

// Selector de planta del encabezado. Es un desplegable propio (no un <select>) para que la
// lista de opciones tenga el mismo estilo que el resto de la app.
export function PlantSwitcher({ plants, selected, onChange }: { plants: Plant[]; selected: Plant; onChange: (plant: Plant) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return <div className={`plant-switcher-control${open ? " open" : ""}`} ref={root} onKeyDown={event => {
    if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }}>
    <button ref={trigger} type="button" className="plant-switcher-trigger" aria-label={`Cambiar planta. Planta actual: ${selected.name}`}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <Factory aria-hidden="true" size={16} className="plant-switcher-icon" />
      <span>{selected.name}</span>
      <ChevronDown aria-hidden="true" className="plant-switcher-chevron" size={16} />
    </button>
    {open && <div className="plant-switcher-menu" id={id} role="listbox" aria-label="Plantas">
      {plants.map(plant => {
        const isSelected = plant.id === selected.id;
        return <button key={plant.id} type="button" role="option" aria-selected={isSelected} className={isSelected ? "selected" : undefined}
          onClick={() => { setOpen(false); trigger.current?.focus(); if (!isSelected) onChange(plant); }}>
          <span>{plant.name}</span>{isSelected && <Check aria-hidden="true" size={15} />}
        </button>;
      })}
    </div>}
  </div>;
}
