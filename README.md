# AeroInspect

Aplicacion para inspeccion y monitoreo de infraestructura externa agroindustrial con drones.

## Requisitos

- Node.js
- npm

## Configuracion

1. Crear el archivo local de entorno a partir del ejemplo:

```bash
cp frontend/.env.example frontend/.env
```

2. Completar las variables necesarias en `frontend/.env`:

```env
VITE_OPENWEATHER_API_KEY=tu_clave_openweathermap
VITE_MAPTILER_KEY=opcional
VITE_MAPBOX_TOKEN=opcional
```

El archivo `.env` no debe subirse a GitHub. Ya esta incluido en `.gitignore`.

## Ejecutar

```bash
npm install
npm run dev --workspace frontend
```

## Build

```bash
npm run build --workspace frontend
```

## Usuarios de prueba

- Usuario: `tecnico` / Contraseña: `Tecnico#123` / Rol: `Tecnico de Mantenimiento`
- Usuario: `jefe` / Contraseña: `Jefe#123` / Rol: `Jefe de Planta`
