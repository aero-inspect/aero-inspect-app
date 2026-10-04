# Planta Luján

Planta de pruebas seleccionable desde «Cambiar planta». La selección se conserva
en `aeroinspect.selectedPlant`; un valor desconocido vuelve a Bragado.

## Referencias y escala

El perímetro usa los seis vértices del polígono de Google Earth entregado por el
usuario, conservado en `docs/lujan-terreno.kml`. Sustituye los cuatro puntos
iniciales y agrega los quiebres del lado sudoeste. Se cambia únicamente el inicio
y el sentido del anillo para conservar el acceso en el mismo lado. El origen
del modelo conserva la referencia inicial de pileta (-34.550844, -59.067347), con X hacia el este
y Z hacia el sur, en metros. El patio se ubica en (-34.550782, -59.067430).

El segundo archivo, `docs/lujan-completo.kml`, incluye terreno (6 vértices), Casa
(22), Pileta (4) y Estacionamiento (4), sin contar el vértice repetido de cierre.
Sus coordenadas se conservan en `frontend/src/data/lujanFootprints.ts`. Cubierta,
fachadas, borde exterior de pileta y estacionamiento siguen esos polígonos sin
rectificar sus ángulos ni sustituirlos por rectángulos. La etiqueta de pileta usa
el centroide del nuevo polígono; el origen de la proyección no cambia.

Las alturas (aprox. 3,0–3,7 m), aberturas, muebles y terminaciones se interpretan
a partir de las fotos. Se mantienen galería abierta, ventanas, puertas de servicio,
puerta de entrada, muro de piedra, parrilla y mesada. El borde de pileta se interpreta
como borde exterior y el agua se retranquea 43 cm; el KML no distingue esas capas.
El estacionamiento se extiende fuera del terreno según el archivo: se dibuja,
pero no modifica el cerco ni habilita selección de activos fuera del perímetro.

Los datos geográficos están en `frontend/src/data/plants.ts`; la arquitectura
está en `frontend/src/components/lujan/geometry.ts`.

## Datos operativos

La planta se elige únicamente desde Inicio. Todas las plantas reutilizan las
mismas páginas, tablas, filtros y formularios. Sólo cambian los datos y el mapa.
El contexto compartido elige la escena en Inicio, Activos y los mapas de misiones.

El backend actual no incluye un identificador de planta. Una capa de
compatibilidad clasifica los activos por coordenadas: los ubicados a menos de
500 m del centro de Luján corresponden a esa planta; los datos históricos restantes
siguen en Bragado. Los planes se filtran por recorrido o activos vinculados;
misiones y programaciones por recorrido/plan, y reportes por activo.
Esta clasificación no reemplaza un futuro identificador de planta en el backend.
Las fallas de red se muestran como errores en las pantallas originales, no como
listas vacías exitosas. No se generan activos o misiones ficticios.

Cambiar de planta vuelve al inicio, limpia las selecciones y remonta el contenido
para evitar que queden datos o formularios de la planta anterior. Los perfiles,
usuarios y drones siguen siendo globales.

## Verificación

- `npm run build`: TypeScript y compilación Vite.
- Navegador: Bragado → Luján → Bragado → Luján.
- Mismas vistas de Inicio, Activos y Misiones en ambas plantas.
- `node scripts/check-plant-scope.cjs`: aislamiento de tablas y selección durante solicitudes en curso.
- Mapa en perspectiva, vista cenital con norte arriba y ampliación.
- Canvas medido con `clientWidth/clientHeight` para respetar el zoom CSS de la app.

La verificación local utiliza el modo de desarrollo `VITE_AUTH_MODE=no-auth`.
No se modificó la autenticación por defecto. Se levantó el backend nativo con
JDK 25, base local en 5432, MQTT en 1883 y RabbitMQ en 5672. Se verificaron
respuestas HTTP 200 a activos, misiones, planes y programaciones a través del
proxy del frontend. El clima utiliza el modo simulado de desarrollo.

Para futuros arranques: `scripts/start-backend-local.ps1`. El backend escucha
sólo en 127.0.0.1:8080 y usa una carpeta temporal corta para los sockets de Java.

## Ajuste de realismo

La ubicación, tamaño y orientación horizontal de casa y pileta proceden del KML.
Las separaciones entre ellas se obtienen de esos contornos. Las superficies usan texturas procedurales
de revoque, piedra, tierra, césped y agua, sin incorporar las fotos privadas
al paquete de la aplicación. El patio incluye suelo en obra, parches de pasto,
cerco de malla y dos árboles jóvenes, como en las fotografías.

Las vistas Patio, Entrada y Lateral se eligen en el mismo desplegable que usa
Bragado. La barra reutiliza los componentes y estilos de Bragado, incluyendo
iluminación, ampliación, brújula y centrado. Las etiquetas están en el panel
de equipos y controles.

El cerco visual coincide con los seis vértices GPS del KML. Se eliminó el
desplazamiento anterior de 4 m del lado sudoeste. La galería estimada y su paso
de servicio se ajustaron dentro del perímetro, conservando puertas metálicas,
bisagras, vereda, alero y tabique de cierre. No se dibuja un camino exterior.

Las altitudes de ambos KML son cero; no aportan alturas de edificios ni relieve.
El patio sigue usando la referencia puntual anterior del usuario.

## Selección de coordenadas en Luján

«Nuevo activo → Seleccionar coordenadas» abre esta misma escena 3D en vista
cenital. El clic intersecta las superficies visibles (incluidos techos), convierte
X/Z a latitud/longitud y coloca un marcador. Arrastrar para orbitar no selecciona
un punto. Los clics fuera del polígono no cambian la selección. Confirmar devuelve
las coordenadas al formulario; reabrir conserva el marcador.

La conversión usa los radios de curvatura WGS84 en la latitud de la pileta y su
inversa compartida, en metros, con norte hacia -Z. Los rectángulos DOM utilizados
para el clic incluyen el zoom CSS. Los siete decimales almacenados conservan la
resolución del cálculo, no implican exactitud topográfica de la arquitectura.
Las posiciones reproducen los trazados entregados por el usuario; la precisión
terrestre depende de la imagen de Google Earth y del trazado. Bragado conserva
su selector anterior pendiente de revisión.

`node scripts/check-lujan-coordinates.cjs` verifica ida/vuelta GPS, escala y ejes,
inclusión en el polígono, anclas del modelo, alineación de todos los segmentos del
cerco, coincidencia de cada vértice de casa/pileta/estacionamiento con el KML y
selección sobre un techo desde un ángulo oblicuo.

## Banquetas

El tipo BANQUETA (etiqueta «Banqueta») se ofrece en creación, edición y filtros
únicamente para Luján. El backend valida que sus coordenadas pertenezcan al
polígono del terreno, tanto al crear como al editar. Requiere la rama luca-lujan
de general-monolith: enum, validación y actualización del CHECK de PostgreSQL.

La escena genera una banqueta de plástico negro de aproximadamente 46 cm de
alto por cada activo BANQUETA persistido, usando sus coordenadas y la altura de
la superficie del modelo. El formulario no aporta modelos anticipados. La lista
devuelta por la API controla altas, movimientos y bajas; no se precargan banquetas.
Las etiquetas abren el detalle y la selección de tabla enfoca la ubicación.

Validación: scripts/check-lujan-assets.cjs, TypeScript y AssetServiceTest en el
backend (persistencia del tipo y rechazo de creación/traslado fuera de Luján).
