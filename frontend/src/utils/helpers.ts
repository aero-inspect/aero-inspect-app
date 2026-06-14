export function getUserInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function getRoleHomeTitle(role: string) {
  if (role === "Jefe de Planta") {
    return "Vista Jefe de Planta";
  }

  return "Vista Tecnico de Mantenimiento";
}

export function canConsultAssets(role: string) {
  return ["Jefe de Planta", "Tecnico de Mantenimiento"].includes(role);
}
