# aero-inspect-app

App inicial para inspecciones con drones sobre infraestructura externa agroindustrial.

## Requisitos

- Node.js LTS 20 o superior
- npm 10 o superior
- Key gratuita de MapTiler para mapa satelital

## Instalacion

```bash
npm install
```

## Configuracion del mapa

Crear el archivo `frontend/.env` usando como base `frontend/.env.example`:

```env
VITE_MAPTILER_KEY=tu_key_de_maptiler
```

Si no se configura la key, el sistema usa Esri como fallback, con menos detalle de zoom.

## Ejecutar

Levantar frontend y backend juntos:

```bash
npm run dev
```

Levantar solo frontend:

```bash
npm run dev:frontend
```

Levantar solo backend:

```bash
npm run dev:backend
```

URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Build

```bash
npm run build
```

## Usuarios de prueba

- Usuario: `tecnico` / Contrasena: `Tecnico#123` / Rol: `Tecnico de Mantenimiento`
- Usuario: `jefe` / Contrasena: `Jefe#123` / Rol: `Jefe de Planta`
- Usuario: `tecnico_inactivo` / Contrasena: `Tecnico#999` / Estado: inactivo

## Login mock

- Usuario y contrasena obligatorios.
- Usuario maximo 50 caracteres.
- Contrasena maximo 100 caracteres.
- Validacion contra usuarios registrados y activos.
- Mensaje generico para credenciales incorrectas.
- Bloqueo temporal por 15 minutos luego de 5 intentos fallidos consecutivos.

## Mapa

La vista de Jefe de Planta usa Leaflet + React-Leaflet para el mapa satelital.

- Con `VITE_MAPTILER_KEY`: usa MapTiler Satellite.
- Sin key: usa Esri World Imagery como fallback.
