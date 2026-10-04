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

- Usuario: `tecnico` / Contraseña: `Tecnico#123` / Rol: `Técnico de Mantenimiento`
- Usuario: `jefe` / Contraseña: `Jefe#123` / Rol: `Jefe de Planta`

## API local en Windows

Además del frontend, la app necesita `general-monolith` en el puerto 8080.
Con el backend en la carpeta hermana y los contenedores de desarrollo existentes:

```powershell
./scripts/start-backend-local.ps1
```

El script inicia PostgreSQL, MQTT y RabbitMQ si están detenidos y ejecuta el
backend con JDK 25, conexión local y perfil `no-auth` limitado a `127.0.0.1`.
El clima usa el modo simulado de desarrollo. Acepta `-JavaHome` y `-BackendPath`
para instalaciones diferentes. No borra ni recrea los contenedores o sus datos.
Mantener esa terminal abierta, además de la del frontend.
