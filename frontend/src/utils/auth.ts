const BACKEND_ROLE_LABELS: Record<string, string> = {
  TECNICO_MANTENIMIENTO: "Tecnico de Mantenimiento",
  JEFE_PLANTA: "Jefe de Planta"
};

export function mapBackendRole(role: string): string {
  return BACKEND_ROLE_LABELS[role] ?? role;
}
