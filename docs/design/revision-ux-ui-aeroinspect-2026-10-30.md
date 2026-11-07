# Revisión de diseño y experiencia de AeroInspect

Fecha: 30 de octubre de 2026. Propuesta de revisión; no se modificó la interfaz.

## Alcance y evidencia

Inspección visual en navegador: ingreso, inicio, activos, formulario de alta, misiones, configuración de misión, drones, reportes de UTN y Bragado, historial, detalle real de inspección y perfil. Se contrastó escritorio de 1440 px con una pantalla de 390 px. Se revisaron componentes, rutas y estilos de las demás vistas, incluyendo planificación, inspección manual, monitoreo, personal, administración de drones, actividad y ayuda. Las conclusiones sobre estas últimas son de código y estructura, no de una prueba visual completa con todos los permisos y estados.

No se crearon ni eliminaron datos, ni se iniciaron vuelos, análisis o validaciones. No es una certificación de accesibilidad ni una prueba con usuarios. Las medidas y colores siguientes son propuestas iniciales que deben verificarse en una primera pantalla implementada.

## Diagnóstico

La app tiene elementos propios —plantas georreferenciadas, recorridos y evidencia fotográfica—, pero los presenta dentro de una estructura repetitiva de panel administrativo: azul en casi todo, bordes y sombras alrededor de cada bloque, texto pequeño, iconos circulares, tarjetas de métricas y mapas sin una tarea claramente asociada.

El mayor problema no es que falten adornos: faltan prioridades visibles. Hay demasiados componentes con el mismo peso, superficies vacías enormes y acciones útiles que se pierden entre datos secundarios. Añadir degradados o más tarjetas reforzaría ese problema.

La dirección propuesta es una herramienta de inspección de campo: sobria, precisa, con mapas y fotografías como protagonistas, metadatos técnicos legibles y estados claros. La identidad se construye con contenido real y composición, no con decoración genérica de drones.

## Sistema visual propuesto

- Fondo mineral claro #F3F2ED; superficies blancas #FFFFFF; texto principal grafito #202B30; secundario #526068; borde #D9DFDC. Son candidatos, pendientes de comprobar contraste por uso.
- Azul profundo #193C50 para navegación y marca; verde petróleo #21695D para la acción principal. Reservar rojo, ámbar y verde de estado para significado operativo; no pintar todas las métricas con colores distintos.
- El color no debe ser el único indicador: acompañar con nombre de estado, icono o forma. Diferenciar severidad del hallazgo y estado de revisión.
- Cuerpo de 15–16 px reales, etiquetas de 13–14 px y títulos de 26–30 px; datos secundarios rara vez por debajo de 12 px. Números con ancho tabular; fuente monoespaciada solo para códigos/coordenadas, no para toda la app.
- Eliminar el escalado global al 80% y redimensionar componentes con medidas reales. Actualmente 14 px declarados se convierten aproximadamente en 11,2 px visuales; no resuelve densidad, reduce legibilidad.
- Barra lateral de 216–232 px, colapsada alrededor de 64 px; filas de navegación de 44–48 px. Hoy declara 317 px antes del escalado y grandes separaciones. El menú no necesita un borde en cada entrada.
- Separaciones base de 8, 16, 24 y 32 px. Radios de 6–10 px, sin redondear cada elemento al máximo. Sombras principalmente para elementos flotantes; listas y paneles se separan con espacio y líneas suaves.
- Botones normales de 40–44 px; blancos táctiles de al menos 44 px como objetivo inicial para uso en campo. Una acción principal por contexto, acciones secundarias discretas y acciones destructivas en un menú separado.
- Filas de tabla de 48–56 px según densidad; cabecera y unidades claras. No rellenar con tarjetas vacías la altura completa del monitor.
- Mantener fotografías con proporción original y un visor dedicado; no usarlas como enormes fondos recortados ni obligar a recorrer toda la página para comparar.

## Revisión por vista

### 1. Ingreso — prioridad media

La fotografía de infraestructura es más propia que una ilustración genérica; conviene conservar ese recurso. El bloque visual domina y el formulario queda desplazado hacia la derecha.

Propuesta: formulario de 360–420 px, con márgenes que funcionen sin recortes; foto del predio con una intervención de marca discreta y logo más pequeño. En pantallas pequeñas, formulario primero y foto opcional. El placeholder debe decir «Tu usuario» si se admite «tecnico», en lugar de insinuar que se requiere email. Errores junto al campo y mensaje útil si falla el servicio; Enter y mostrar contraseña deben funcionar de forma previsible. Evitar contenido de marketing que distraiga del acceso.

### 2. Estructura, navegación y planta — prioridad alta

El selector de planta solo aparece en inicio. En activos y reportes se pierde la confirmación del contexto. El clima y el acceso al perfil se repiten en muchos encabezados, mientras el perfil ya está en la barra lateral.

Propuesta: encabezado global compacto con planta siempre visible, notificaciones y usuario. Navegación principal: Inicio, Activos, Misiones y Reportes; Drones permanece visible para quien opera vuelos. Administración agrupada para el jefe, sin mezclarla con operación diaria. Ayuda en un lugar fijo. Un único acceso al perfil basta. La selección de planta debe usar la misma lista y reglas en toda la app, incluyendo altas, reportes y personal.

### 3. Inicio — prioridad alta

La columna de últimas misiones se estira aunque esté vacía; el progreso semanal queda muy abajo. «0 de 0» no aporta una lectura útil. El mapa tiene identidad, pero no debería desplazar el trabajo pendiente.

Propuesta: una franja breve de «Qué requiere atención» con inspecciones por revisar y próxima misión, cada elemento navegable. Mapa en aproximadamente 60–65% del ancho y lista operativa en 35–40%; altura inicial alrededor de 460–560 px, adaptable. Si no hay misiones, estado vacío corto con «Crear primera misión», no una tarjeta de casi toda la pantalla. Quitar el anillo semanal si no tiene meta o periodo útil; sustituir por un dato contextual cuando haya actividad. El inicio del jefe prioriza hallazgos/revisión; el del técnico, próximas tareas.

### 4. Mapas Bragado, Luján y UTN — prioridad alta

Los controles cambian entre plantas. El mapa aparece repetidamente, a veces con el mismo encuadre general aunque se esté trabajando sobre un objeto pequeño. UTN tiene solo Zoom + por solicitud del usuario.

Propuesta: conservar ese control mínimo en UTN y mejorar el encuadre automático al seleccionar un activo, la respuesta del clic y las etiquetas. No reintroducir el panel de controles descartado. Vista general en inicio, foco en el activo en detalle y selección precisa en el alta. Las etiquetas no deben quedar fuera de pantalla ni tapar objetos vecinos. Indicar instrucciones breves únicamente al entrar en modo de ubicación. Para recuperarse de una cámara perdida, evaluar un gesto documentado o un restablecimiento contextual antes de sumar botones. Distinguir un modelo aproximado de una ubicación medida cuando afecte decisiones.

### 5. Listado de activos — prioridad alta

La tabla queda estrecha frente a un mapa enorme. Nombre, tipo y estado tienen poco espacio y se repiten acciones pequeñas de ojo/papelera. Con un solo activo, la lista ocupa una altura desproporcionada.

Propuesta: panel de lista de 360–420 px o 40% del contenido y mapa flexible. Buscar, tipo y estado en una sola barra alineada. Fila seleccionada vinculada a un resaltado del objeto y su encuadre. Nombre clicable y menú «Más» para editar/eliminar; no exponer una papelera al mismo nivel que consultar en cada fila. Mostrar código en segundo nivel. La cantidad de filas debe determinar la altura útil de la lista, sin forzar una columna vacía.

### 6. Crear y editar activo — prioridad alta

El modal de alta es pequeño para la cantidad de campos; la ubicación abre otro modal. El código está separado abajo y la fecha de mantenimiento se pide como obligatoria incluso al dar de alta un activo sin historial.

Propuesta: un único panel amplio o pantalla dividida, con formulario y mapa en el mismo contexto. Orden: nombre y tipo; ubicación; estado/código; foto y documentos opcionales. Código generado y editable si el negocio lo permite. «Sin mantenimiento registrado» como opción explícita en lugar de obligar a inventar una fecha. Mostrar nombres de zonas o una confirmación legible además de latitud/longitud. Agrupar adjuntos en «Información adicional». Al guardar, cerrar y resaltar el nuevo activo; aviso breve con «Ver activo», en vez de sumar otra ventana de éxito.

Hay dos caminos de alta con comportamientos distintos: una vista antigua conserva datos locales y la pantalla de activos usa la API. Unificarlos para todas las plantas antes de rediseñar el formulario evita una interfaz bonita con resultados distintos.

### 7. Detalle de activo — prioridad media/alta

Propuesta: encabezado con nombre, código, tipo y estado; foto y datos esenciales; historial de inspecciones debajo. «Editar» como acción secundaria visible; eliminación en «Más». Mapa con foco real sobre el objeto, no toda la planta. Documentos en una lista con nombre/tamaño y apertura clara. Separar mantenimiento de inspecciones si representan procesos distintos. Evitar abrir un detalle dentro de otro modal y después un editor encima.

### 8. Misiones y rutinas — prioridad alta

Cuatro tarjetas de totales compiten con «Nueva misión» y «Generar plan». Para alguien nuevo no está claro cuál debe hacer primero.

Propuesta: acción dominante «Nueva misión» que permita elegir un plan existente o crear uno. «Planes de vuelo» y «Programaciones» como recursos secundarios claramente nombrados. Métricas como filtros compactos con conteo, no cuatro tarjetas decorativas. Tabla ordenada por próxima acción: en curso, pendientes y finalizadas. Mostrar fecha, plan, dron, responsable y estado con las acciones correspondientes a ese estado. Rutinas con próxima ejecución y regla en lenguaje natural. Estado vacío que explique el primer paso.

### 9. Generar plan de vuelo — prioridad alta

El editor combina recorrido grabado, puntos de paso/interés, coordenadas, altitud, rumbo, espera, fotos y ángulos. Muchos detalles técnicos aparecen juntos.

Propuesta: mapa principal con lista numerada del recorrido y un inspector de un solo punto seleccionado. Primero «Qué se inspecciona» y «Tomar foto»; luego ajustes avanzados con coordenadas y gimbal. Usar «Altura sobre el despegue (m)» si esa es la semántica real, en lugar de «Altitud (z)». Diferenciar guardado del punto, generación del plan y confirmación final. Mostrar cambios sin guardar y estado de guardado en una posición estable. Se puede mantener un editor técnico completo, pero no debe ser el primer nivel de lectura.

### 10. Configurar misión — prioridad alta

La autonomía se repite bajo el mapa y dentro del formulario. Sin telemetría se calcula con batería completa, algo que puede parecer una comprobación real. Hay una acción deshabilitada sin una lista clara de lo que falta.

Propuesta: secuencia corta «Recorrido → Dron y momento → Revisar». Una sola estimación con origen explícito: «Estimación con batería supuesta al 100%», sin presentarla como dato en vivo. Selección «Ahora / Programar» antes de frecuencia y calendario. Mostrar resumen de activos, duración estimada, dron y próxima fecha antes de crear. Si falta un plan o activo, explicar el paso requerido junto al botón; no obligar a adivinar por qué está bloqueado.

### 11. Inspección manual / grabar recorrido — prioridad alta

El texto actual explica que «Cortar grabación» se usa para descartar el vuelo; el nombre no comunica esa consecuencia.

Propuesta: una pantalla de tarea, con dron y conexión arriba, estado de grabación y tiempo visible, y un control principal que cambie según la fase. Si cortar descarta, decir «Descartar recorrido» y confirmar esa consecuencia. Separar vuelo manual de grabación del recorrido: iniciar una grabación no debe sugerir que la web pilota el dron. Después del aterrizaje, ofrecer «Usar recorrido para crear plan». Unificar términos entre inspección manual y carga manual de fotos: hoy describen tareas distintas con nombres cercanos.

### 12. Monitorear misión — prioridad alta

Propuesta: mapa y progreso como centro. Batería, enlace, altura y último dato en una banda operativa legible; GPS avanzado y velocidades secundarias bajo «Detalles». «Sin datos», «Datos desactualizados» y «Desconectado» deben ser estados distintos. «Cancelar» debería comunicar qué orden envía y qué estado espera; no cambiarla por «Pausar» o «Aterrizar» sin que esa función exista. Evitar porcentajes precisos si el total del recorrido no es válido. Al terminar, transición clara hacia fotos y revisión. Esta vista debe probarse con telemetría real y estados de fallo antes de cerrar su diseño.

### 13. Drones / telemetría — prioridad media/alta

Se observa un modelo 3D del dron ocupando un bloque grande mientras los datos están vacíos. Hay tarjetas separadas para estado, batería, posición y GPS, y después chequeos que repiten parte de esa información.

Propuesta: lista/selector de drones con estado y frescura del dato; ficha compacta con batería, conexión y disponibilidad operativa. Una lista de chequeos que diga qué falta y qué hacer. Coordenadas y voltaje como detalles. El modelo 3D puede quedar en «Ficha del equipo», sin competir con el estado operativo. No llamar «Última actualización» a una hora de consulta de pantalla si no corresponde a la última telemetría recibida; comprobar esa semántica.

### 14. Administración de drones — prioridad media

Revisada por código. Propuesta: agrupar dentro de Administración; tabla de identificación, modelo, estado y acciones. Alta/edición con el mismo patrón del resto de la app, sin variantes propias de botones y modales. Separar un estado administrativo de la conexión actual. Si no se puede eliminar por tener misiones, explicar la causa y ofrecer desactivar cuando el sistema lo soporte.

### 15. Reportes: estado de planta — prioridad alta

El acceso temporal al módulo de IA aparece antes del título. Los gráficos son compactos, pero «Sin gravedad», «Sin determinar», «Sin resultados» y «Provisional» requieren interpretación. Los filtros de tipos no incluyen Banqueta en la vista observada.

Propuesta: sacar la franja temporal del encabezado y llevar la función útil a «Cargar fotos». La primera lectura debe responder «Qué activos requieren revisión». Diferenciar sin inspeccionar, analizado sin hallazgos, pendiente de validar y validado. Mostrar claramente qué resultados son provisionales, sin que parezcan una conclusión humana definitiva. Gráficos clicables que filtren la lista; tipos de activo derivados de la planta y de datos reales. No mostrar siete barras de cero cuando todavía no hay inspecciones.

### 16. Reportes históricos y personalizado — prioridad alta

Propuesta: una fila por inspección, con fecha, activos, revisión y gravedad; abrir desde el nombre. Filtros de fecha agrupados como «Periodo», búsqueda y solo los filtros más usados visibles. «Descargar PDF» como acción secundaria; evitar repetir enlace de nombre y ojo si hacen lo mismo. Para personalizado: elegir periodo y activos con evidencia válida, informar cuántas capturas se incluirán y explicar las exclusiones antes de generar. Mantener filtros al volver del detalle. Unificar la palabra «gravedad» o «severidad» en todo el producto.

### 17. Capturas por activo — prioridad alta

Propuesta: selector de activo a la izquierda, tira cronológica con fecha y miniaturas, visor a la derecha. Filtros «Con hallazgos», «Pendientes de revisión» y «Todas». Seleccionar dos capturas para comparar solo si existe esa necesidad; no sumar un gráfico decorativo. Mantener escala y orientación de imágenes al comparar. Conservar el acceso al historial desde la ficha del activo.

### 18. Detalle de reporte / validación — prioridad alta

En el reporte con datos reales, cada foto ocupa una gran sección y repite metadatos, advertencias y controles; con 14 capturas la revisión exige mucho desplazamiento. El bloque de metadatos también deja celdas vacías.

Propuesta: espacio de revisión con activos/evidencias en una columna de 240–280 px, imagen principal al centro y decisión/comentario en un inspector de 300–360 px, cuando el ancho lo permita. En portátil, inspector plegable y navegación anterior/siguiente. Pestañas «Original / Corrosión / Fisuras», zoom enlazado y metadatos secundarios desplegables. Una sola explicación de que la IA propone y la persona valida. Progreso «Revisadas 4 de 14», guardado claro y acciones finales visibles sin bajar toda la página. No confundir porcentaje de píxeles afectados con gravedad estructural. Cerrar el proceso con identidad de quien valida, fecha y trazabilidad, no un simple campo ambiguo de firma.

### 19. Carga manual / análisis de fotos — prioridad alta

Propuesta: llamarla «Cargar fotos de inspección» y organizar tres etapas reales: elegir inspección/activos, subir y asignar, analizar y revisar. Miniaturas en grilla, asignación por lotes visible cuando hay selección y errores por archivo. Progreso por foto con posibilidad de reintentar las fallidas sin duplicar las ya enviadas. No exponer «módulo» como tarea del usuario ni repetir el nombre del modelo. Tras el análisis, llevar al mismo espacio de revisión que el resto de inspecciones.

### 20. Perfil — prioridad media

Se observan grandes superficies con datos vacíos, campos deshabilitados que parecen líneas y bloques completos para acciones simples como cerrar sesión. La planta de la cuenta puede confundirse con la planta de trabajo.

Propuesta: ficha de datos en lectura normal y edición solo al pedirla. Separar «Planta asignada» de «Planta seleccionada». Seguridad como sección compacta; cerrar sesión en el menú de usuario. Metadatos de cuenta y actividad como elementos secundarios, sin tres tarjetas dominantes. Eliminar «Eliminar cuenta» hasta que exista su comportamiento real: actualmente el botón final solo cierra el modal.

### 21. Actividad y notificaciones — prioridad media

Propuesta: feed compacto por día, con actor, acción, objeto y planta; cada evento lleva al elemento correspondiente. Notificaciones para cosas que necesitan atención y actividad como historial, sin duplicar todos los eventos en ambos. Indicador de sin leer fiable y filtros por tarea. Mostrar hora relativa con fecha completa disponible. Verificar que las actividades UTN se clasifiquen igual que activos y reportes: persiste lógica por coordenadas que reconoce solo Luján en ActivityService.

### 22. Gestión de personal — prioridad media/alta

Revisada por código. El formulario de crear usuario está siempre presente junto al listado.

Propuesta: listado como pantalla principal y «Crear usuario» en panel separado. Rol y planta con nombres consistentes y todas las plantas habilitadas por la fuente única. Estado activo/inactivo visible; cambios de permisos con confirmación de alcance, sin interruptores ambiguos. Preferir desactivación y conservar historial cuando el negocio lo requiera. Evitar dar a una contraseña inicial la misma exposición que a datos administrativos comunes. Verificar teclado y foco en los selectores personalizados.

### 23. Centro de ayuda — prioridad alta por confianza

El código muestra enlaces que cancelan su navegación, botones sin acción y contactos que no están respaldados por una integración en esta vista.

Propuesta: quitar toda promesa que no funcione. Mantener cuatro guías reales ligadas a las tareas: crear activo, preparar misión, revisar resultados y descargar reporte. Cada guía breve, actualizada y accesible desde el paso en que se necesita. Un solo canal de soporte verificado. No mostrar estado del servicio, manual descargable o capacitación si no hay un destino real. Ayuda contextual antes que una página llena de tarjetas.

### 24. Vistas antiguas, de prueba y alternativas — prioridad alta

CrearReporte, ReporteDetalle y Reportes conservan estructuras con datos fijos; hay rutas de demostración y una prueba de telemetría. No todas forman parte del flujo normal observado.

Propuesta: identificar cuáles siguen accesibles, retirarlas del recorrido de producción o marcarlas explícitamente como demostración. Conservar un solo flujo real de alta, reporte y validación. La prueba SSE debe ser una herramienta de desarrollo, no una opción operativa normal. No diseñar dos experiencias distintas para el mismo trabajo ni conservar botones que aparenten guardar información pero solo cambien estado local.

## Adaptación a pantalla y accesibilidad

En el ancho pequeño inspeccionado, la experiencia conserva una composición de escritorio miniaturizada, no una jerarquía útil para campo. Antes de pulir colores hay que definir escritorio, portátil/tablet y consulta móvil como layouts explícitos.

- Escritorio: dos o tres zonas solo si hay espacio real. Pantalla de lectura limitada a unos 1200–1360 px; mapa/revisión de fotos pueden usar el ancho disponible.
- Tablet: navegación colapsada, lista y mapa alternables, formulario en una columna, acciones táctiles grandes.
- Móvil: primero estado, siguiente acción y lista; mapa o imagen como vista de trabajo expandible. No intentar mostrar simultáneamente toda la tabla, la barra lateral y el mapa.
- Probar a 390, 768, 1024 y 1440 px y con zoom del navegador al 200%, sin pérdidas de acciones.
- Revisar foco visible, orden de Tab, Escape, devolución del foco al cerrar modal, nombres accesibles y errores asociados a sus campos. Los menús propios requieren comportamiento completo de teclado; preferir controles nativos donde no aporte valor reemplazarlos.
- Texto de error accionable: qué ocurrió, qué se conserva y cómo continuar. No exponer mensajes internos ni culpar al usuario por una planta que la app permite seleccionar.

## Cambios funcionales que sostienen el diseño

1. Fuente única de plantas y pertenencia de activos; los errores recientes de Banqueta y reportes muestran que la configuración está dispersa entre frontend y backend.
2. Navegación por URL que pueda recargar detalle de misión/reporte sin depender solo de un ID guardado en el estado de Home. Evaluar identificadores en ruta/query y estados vacíos si falta el recurso.
3. Unificación de formularios y patrones, sin reescribir todo de una vez. Los numerosos CSS por página y capas de estilos antiguos/actuales facilitan diferencias involuntarias.
4. Separar carga inicial, vacío verdadero, filtro sin resultados, error de conexión y datos desactualizados. Cada uno requiere una presentación distinta.
5. Un vocabulario único: activo, recorrido, plan, misión, inspección, evidencia y reporte deben tener una relación fácil de entender.

## Orden recomendado de trabajo

**Primera entrega: identidad y base.** Implementar una única pantalla piloto —Activos— con escala real, navegación compacta, selector de planta persistente, tipografía y colores. Evaluarla con un activo y con una lista larga antes de extender el patrón.

**Segunda entrega: tareas cotidianas.** Alta/edición de activo sin modales apilados, lista/mapa conectados e inicio centrado en pendientes. Pruebas de crear una banqueta UTN, volver a verla y consultar su historial.

**Tercera entrega: inspección y reportes.** Nueva misión con recorrido claro; revisión de fotos con inspector; jerarquía de resultados provisionales/validados; carga manual integrada y eliminación de opciones ficticias.

**Cuarta entrega: operación y cierre.** Telemetría con frescura de datos, administración, perfil, ayuda y adaptación a campo. No postergar fallos de accesibilidad de acciones críticas hasta esta fase.

## Criterios para decidir si mejoró

- El usuario identifica planta, tarea y acción principal sin abrir un menú.
- Crear un activo no requiere abrir una segunda ventana encima del formulario.
- Una fila y su objeto del mapa se pueden relacionar sin buscar manualmente la posición.
- Se entiende la diferencia entre «sin inspeccionar» y «sin hallazgos».
- Revisar 14 fotos no exige recorrer 14 bloques largos para alcanzar la acción final.
- Una acción deshabilitada explica qué falta; ninguna opción visible carece de destino real.
- A 390 px y con zoom de texto las acciones siguen utilizables.
- Comparar tareas con usuarios de campo y registrar tiempo, errores y dudas antes/después. No asignar metas numéricas inventadas sin una medición inicial.
