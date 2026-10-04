import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function MapToolbarSelect<T extends string>({
  ariaLabel,
  title,
  value,
  options,
  onChange
}: {
  ariaLabel: string;
  title?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="bragado-map-select" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        title={title}
        type="button"
      >
        <span>{active.label}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="bragado-map-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={option.value === value ? "selected" : undefined}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


