# aero-inspect-app

Base inicial para una app de inspecciones con drones para infraestructura externa agroindustrial.

## Estructura

- `frontend`: interfaz visual en React + Vite.
- `backend`: API inicial en Express.

## Ejecutar

```bash
npm install
npm run dev
```

El frontend queda en `http://localhost:5173` y el backend en `http://localhost:4000`.

Por ahora el login es simulado con usuarios en memoria.

## Usuarios de prueba

- Usuario: `tecnico` / Contrasena: `Tecnico#123` / Rol: `Tecnico de Mantenimiento`
- Usuario: `jefe` / Contrasena: `Jefe#123` / Rol: `Jefe de Planta`
- Usuario: `tecnico_inactivo` / Contrasena: `Tecnico#999` / Estado: inactivo

Reglas mock implementadas:

- Usuario y contrasena obligatorios.
- Usuario maximo 50 caracteres.
- Contrasena maximo 100 caracteres.
- Validacion contra usuarios registrados y activos.
- Mensaje generico para credenciales incorrectas.
- Bloqueo temporal por 15 minutos luego de 5 intentos fallidos consecutivos.
