import type { MockUser, SessionUser } from "../types";
import { REGISTERED_USERS } from "../data/mockUsers";

export function validateLoginFields(username: string, password: string) {
  const isUsernameMissing = !username.trim();
  const isPasswordMissing = !password.trim();

  if (isUsernameMissing && isPasswordMissing) {
    return "Ingrese su usuario y contrasena.";
  }

  if (isUsernameMissing) {
    return "Ingrese su usuario.";
  }

  if (isPasswordMissing) {
    return "Ingrese su contrasena.";
  }

  if (username.length > 50) {
    return "El nombre de usuario no puede superar los 50 caracteres.";
  }

  if (password.length > 100) {
    return "La contrasena no puede superar los 100 caracteres.";
  }

  return "";
}

export function getMockLoginResult(username: string, password: string) {
  const registeredUser = REGISTERED_USERS.find((item) => item.username === username);

  if (!registeredUser?.active || registeredUser.password !== password) {
    return null;
  }

  return {
    name: registeredUser.name,
    role: registeredUser.role
  } as SessionUser;
}

