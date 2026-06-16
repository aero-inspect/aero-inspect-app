import type { MockUser } from "../types";

export const REGISTERED_USERS: MockUser[] = [
  {
    username: "tecnico",
    password: "Tecnico#123",
    name: "Tecnico de Mantenimiento",
    role: "Tecnico de Mantenimiento",
    active: true
  },
  {
    username: "jefe",
    password: "Jefe#123",
    name: "Jefe de Planta",
    role: "Jefe de Planta",
    active: true
  },
  {
    username: "tecnico_inactivo",
    password: "Tecnico#999",
    name: "Tecnico Inactivo",
    role: "Tecnico de Mantenimiento",
    active: false
  }
];

