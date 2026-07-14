# Hardware del Dron

Este documento lista **todos los componentes físicos** con los que contamos para construir el dron de inspección, con sus especificaciones clave, enlaces a documentación oficial y notas de montaje.

<img src="https://holybro.com/cdn/shop/files/30188-1.jpg?v=1760334325" alt="PX4 Development Kit X500 v2" width="450"/>

_PX4 Development Kit — X500 v2 (Holybro)_

---

## Índice

1. [Resumen de componentes](#1-resumen-de-componentes)
2. [Detalle de cada componente](#2-detalle-de-cada-componente)
3. [Presupuesto de peso](#3-presupuesto-de-peso)
4. [Documentación de referencia](#4-documentación-de-referencia)
5. [Seguridad](#5-seguridad)
6. [Por qué el simulador equivale a usar el dron](#6-por-qué-el-simulador-equivale-a-usar-el-dron)

---

## 1. Resumen de componentes

| #   | Componente                                                                 | Rol                                                              | Ubicación            |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------- |
| 1   | **Frame Holybro X500 V2** (con motores, ESCs, hélices y PDB preinstalados) | Estructura del dron                                              | Dron                  |
| 2   | **Pixhawk 6C**                                                             | Controladora de vuelo (FMU) — corre PX4                          | Dron                  |
| 3   | **Power Module PM02 V3 (12S)**                                             | Alimentación regulada 5.2V al Pixhawk + sensado de batería       | Dron                  |
| 4   | **GPS M8N (u-blox NEO-M8N)**                                               | Posicionamiento GNSS + brújula                                   | Dron (mástil)         |
| 5   | **SiK Telemetry Radio V3 (433/915 MHz)**                                   | Telemetría MAVLink dron ↔ estación de tierra                     | Dron + Tierra (par)   |
| 6   | **Power Distribution Board (PDB)**                                         | Distribución de energía (XT60 batería / XT30 ESCs y periféricos) | Dron                  |
| 7   | **Batería LiPo 4S**                                                        | Fuente de energía principal                                      | Dron                  |
| 8   | **Raspberry Pi 3 Model B**                                                 | Companion computer — Módulo de Control de Vuelo (Python/MAVSDK)  | Dron                  |
| 9   | **Cámara Gimbal SIYI A8 mini**                                             | Captura de imágenes/video 4K estabilizado                        | Dron (riel inferior)  |

---

## 2. Detalle de cada componente

### 2.1 Frame — Holybro X500 V2 Kit

<img src="https://holybro.com/cdn/shop/files/30120_x500_v2_2.jpg?v=1760334137" alt="X500 V2 Frame" width="380"/>

Estructura de fibra de carbono con todo el tren de potencia preinstalado. Trae rieles de montaje inferiores (2 barras de 10 mm × 250 mm) donde va la cámara, y la plataforma superior tiene perforaciones para GPS y companion computers (Raspberry Pi / Jetson).

**Incluye preinstalado:**

- 4× Motores **Holybro 2216 KV920** (conector XT30)
- 4× ESC **BLHeli S 20A** (compatibles con batería 4S)
- 6× Hélices **1045** con retenedor anti-desprendimiento
- **PDB** (ver 2.6)
- Tren de aterrizaje, soporte de batería con 2 correas, herramientas de armado

**Especificaciones mecánicas:**
| Parámetro | Valor |
|---|---|
| Distancia entre ejes (wheelbase) | 500 mm |
| Peso del frame | 610 g |
| Carga útil máxima | 1500 g (sin batería, al 70% de acelerador) |
| Tiempo de vuelo | ~18 min en hover sin payload (batería 5000 mAh) |
| Altura tren de aterrizaje | 215 mm |
| Batería recomendada | 4S 3000–5000 mAh 20C+ con XT60 |

[Página del producto](https://holybro.com/products/x500-v2-kits) · [Guía de armado (PDF)](https://cdn.shopifycdn.net/s/files/1/0604/5905/7341/files/X500_V2_Assembly_Guide_en.pdf?v=1720853913) · [Spec de motores](https://cdn.shopify.com/s/files/1/0604/5905/7341/files/X500MotorSpec.png?v=1678791632)

---

### 2.2 Controladora de vuelo — Pixhawk 6C

<img src="https://holybro.com/cdn/shop/products/11054Pixhawk6C-Plasticcase_1.jpg?v=1775119916" alt="Pixhawk 6C" width="320"/>

Es el "cerebro" de vuelo del dron: ejecuta el firmware **PX4 Autopilot** (viene preinstalado), estabiliza la aeronave, ejecuta los waypoints y expone telemetría por **MAVLink**. Se comunica con la Raspberry Pi por puerto serial (UART).

**Especificaciones:**
| Parámetro | Valor |
|---|---|
| Procesador FMU | STM32H743 (Cortex-M7 @ 480 MHz, 2MB flash, 1MB RAM) |
| Procesador IO | STM32F103 |
| IMU (redundante) | ICM-42688-P + BMI088 (con aislación de vibraciones y calefacción) |
| Magnetómetro | IST8310 |
| Barómetro | MS5611 |
| Dimensiones / Peso | 84.8 × 44 × 12.4 mm / ~35 g (case plástico) |
| Firmware | PX4 (preinstalado) — también compatible con ArduPilot |

**Puertos relevantes para nosotros:** `TELEM1` (radio SiK), `TELEM2` (Raspberry Pi), `GPS1` (GPS M8N), `POWER` (PM02), salidas PWM a los ESCs.

[Página del producto](https://holybro.com/products/pixhawk-6c) · [Documentación técnica](https://docs.holybro.com/autopilot/pixhawk-6c) · [Pixhawk 6C en PX4 Docs](https://docs.px4.io/)

**Diagrama de cableado de referencia (Holybro):**

<img src="https://cdn.shopify.com/s/files/1/0604/5905/7341/files/Pixhawk6CSampleWiringDiagram_2048x2048.jpg?v=1700552482" alt="Diagrama de cableado Pixhawk 6C" width="550"/>

---

### 2.3 Módulo de potencia — PM02 V3 (12S)

<img src="https://holybro.com/cdn/shop/products/15010_1_2b6143da-9f4b-4868-a638-b060a3b4ef0e.jpg?v=1760166820" alt="PM02 V3" width="320"/>

Se conecta en serie entre la batería y la PDB. Entrega **5.2V regulados** al Pixhawk por el puerto `POWER` y le informa voltaje y consumo de la batería (señal analógica, cable JST-GH 6 pines). Fundamental para el failsafe de batería baja.

| Parámetro          | Valor                                |
| ------------------ | ------------------------------------ |
| Voltaje de entrada | 2S–12S                               |
| Corriente continua | 60A (XT60 presoldado: 30A continuos) |
| Salida             | 5.2V DC @ 3A máx                     |
| Peso               | 20 g                                 |

[Página del producto](https://holybro.com/collections/power-modules-pdbs/products/pm02-v3-12s-power-module) · [Guía de configuración PX4](https://docs.holybro.com/power-module-and-pdb/power-module)

---

### 2.4 GPS — Holybro M8N (u-blox NEO-M8N)

_Pendiente: agregar foto de nuestra unidad (módulo redondo Ø50 mm con botón de seguridad)._

Módulo GNSS con brújula integrada. Provee posición y rumbo al Pixhawk. Se monta sobre el **mástil** incluido en el kit, lo más alejado posible de motores y cableado de potencia (interferencia magnética sobre la brújula).

| Parámetro                   | Valor                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ |
| Receptor                    | u-blox NEO-M8N (GPS, GLONASS, Galileo, BeiDou, QZSS, SBAS)                     |
| Brújula                     | IST8310                                                                        |
| Sensibilidad / Cold start   | −167 dBm / ~26 s                                                               |
| Frecuencia de actualización | hasta 10 Hz                                                                    |
| Consumo / Peso              | <150 mA @ 5V / 32 g                                                            |
| Conector                    | JST-GH 10 pines → puerto `GPS1` del Pixhawk (incluye botón de seguridad y LED) |

> **Nota:** en el listado original del kit, el link de "M8N GPS" apunta por error a la página del PM02 (el error viene de la propia web de Holybro). La documentación correcta está abajo.

[Documentación GPS Holybro](https://docs.holybro.com/gps-and-rtk-system) · [GPS en PX4 Docs](https://docs.px4.io/main/en/gps_compass/)

---

### 2.5 Telemetría — SiK Telemetry Radio V3 (par)

<img src="https://holybro.com/cdn/shop/files/17013-1.jpg?v=1770011674" alt="SiK Telemetry Radio V3" width="380"/>

Par de radios (una va en el dron conectada a `TELEM1`, la otra por USB a la notebook de la estación de tierra). Transporta **MAVLink** entre el Pixhawk y **QGroundControl**. Alcance típico >300 m out-of-the-box.

| Parámetro             | Valor                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Potencia              | 100 mW (20 dBm)                                                                            |
| Frecuencia            | 433 MHz o 915 MHz (verificar la variante de nuestro kit y la banda permitida en Argentina) |
| Interfaz              | UART 3.3V (JST-GH 6 pines) + Micro-USB                                                     |
| Data rate por defecto | 57.6 kbps serial / 64 kbps RF                                                              |
| Peso                  | 23.5 g c/u (con antena)                                                                    |
| Firmware              | SiK open-source, framing MAVLink                                                           |

[Página del producto](https://holybro.com/products/sik-telemetry-radio-v3) · [Guía rápida](https://docs.holybro.com/telemetry-radio/sik-telemetry-radio-v3)

---

### 2.6 Power Distribution Board (PDB)

_Pendiente: agregar foto de nuestra unidad (viene preinstalada en el frame)._

Placa que distribuye la energía de la batería a los 4 ESCs y a periféricos. **Entrada XT60** (desde el PM02/batería) y **salidas XT30**. Sin soldadura: los ESCs se enchufan directamente.

Las salidas XT30 libres son las que vamos a usar para alimentar la **cámara A8 mini** (acepta el voltaje de la 4S directo) y el **BEC 5V de la Raspberry Pi**.

[Repuestos X500 V2 (incluye PDB)](https://holybro.com/collections/multicopter-kit/Spare-Part)

---

### 2.7 Batería — LiPo 4S (1 unidad)

_Pendiente: agregar foto, marca, capacidad (mAh) y C-rating de nuestra unidad._

Fuente de energía de todo el sistema. El frame recomienda **4S 3000–5000 mAh, 20C+, conector XT60**.

> Con **una sola batería** el tiempo efectivo de pruebas de campo es de ~15 min por salida.

---

### 2.8 Companion Computer — Raspberry Pi 3 Model B

_Pendiente: agregar foto de nuestra unidad._

Computadora de misión embarcada. En nuestra arquitectura ejecuta el **Módulo de Control de Vuelo (Python/MAVSDK)**: recibe comandos por MQTT desde el backend, los traduce a MAVLink hacia el Pixhawk, retransmite telemetría y sincroniza las imágenes con S3 al finalizar la misión. Se monta en la plataforma del frame (tiene perforaciones compatibles).

| Parámetro      | Valor                                                           |
| -------------- | --------------------------------------------------------------- |
| SoC            | Broadcom BCM2837, 4× Cortex-A53 @ 1.2 GHz                       |
| RAM            | 1 GB                                                            |
| Conectividad   | WiFi 802.11n **(solo 2.4 GHz)**, Bluetooth 4.1, Ethernet 10/100 |
| Puertos        | 4× USB 2.0, HDMI, CSI (cámara), 40 pines GPIO (incluye UART)    |
| Alimentación   | 5V / 2.5A por micro-USB o GPIO                                  |
| Almacenamiento | microSD                                                          |

> Para el MVP alcanza. Si el manejo de video / sincronización a S3 se vuelve cuello de botella, evaluar upgrade a Raspberry Pi 4/5 (mismo footprint de montaje).

[Página oficial](https://www.raspberrypi.com/products/raspberry-pi-3-model-b/)

---

### 2.9 Cámara — SIYI A8 mini (gimbal 3 ejes)

<img src="https://cdn.shopify.com/s/files/1/0604/5905/7341/files/A8MINI_1_480x480.jpg?v=1680860555" alt="SIYI A8 mini montada en X500" width="300"/> <img src="https://cdn.shopify.com/s/files/1/0604/5905/7341/files/A8MINI_2_480x480.jpg?v=1680860564" alt="SIYI A8 mini montada en X500 (detalle)" width="300"/>

_La A8 mini montada en los rieles inferiores de un X500 (fotos de referencia de Holybro)._

Cámara gimbal estabilizada en 3 ejes para la captura de la evidencia visual de las inspecciones. Cumple sobradamente el requerimiento de resolución mínima 1080p/4K del proyecto.

| Parámetro          | Valor                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| Sensor             | Sony 1/1.7" starlight CMOS, 8 MP efectivos                                    |
| Video / Foto       | 4K UHD hasta 25 fps / 8 MP · zoom digital 6X · HDR                            |
| Estabilización     | Gimbal 3 ejes (vibración angular ±0.01°)                                      |
| Rango pitch / yaw  | −135°~+45° / −160°~+160°                                                      |
| Salidas de video   | **Ethernet**, HDMI, CVBS (AV)                                                 |
| Control            | UART / S.Bus / UDP — soporta protocolo de gimbal SIYI y modos Follow/Lock/FPV |
| Alimentación       | 11–16.8 V (se alimenta **directo de la 4S** vía XT30 de la PDB)              |
| Dimensiones / Peso | 55 × 55 × 70 mm / ~95 g                                                       |
| Almacenamiento     | microSD (fotos con geotag si recibe datos del FC)                             |

**Para el equipo:** la salida **Ethernet** es la vía natural para llevar el video a la Raspberry Pi; el control del gimbal se hace por UART/UDP. La integración detallada se documentará aparte.

[Manual oficial (PDF, SIYI)](https://siyi.biz/siyi_file/A8%20mini/A8%20mini%20User%20Manual%20v1.10%20.pdf)

---

## 3. Presupuesto de peso

| Componente                                      | Peso aprox.       |
| ----------------------------------------------- | ----------------- |
| Frame X500 V2 (con motores, ESCs, PDB, hélices) | 610 g             |
| Pixhawk 6C + cables                             | ~40 g             |
| PM02 V3                                         | 20 g              |
| GPS M8N + mástil                                | ~40 g             |
| Radio SiK (aire)                                | 24 g              |
| Raspberry Pi 3B + soporte                       | ~60 g             |
| SIYI A8 mini + soporte                          | ~110 g            |
| Batería 4S 5000 mAh                             | ~450–520 g        |
| **Total estimado al despegue**                  | **~1.35–1.45 kg** |

Dentro del límite: el frame soporta **1500 g de payload** (sin contar batería) al 70% de acelerador. Tenemos margen, pero cada gramo extra reduce el tiempo de vuelo (~18 min de referencia sin payload → esperar **12–15 min reales** con nuestra configuración).

---

## 4. Documentación de referencia

| Recurso                                                   | Link                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PX4 Autopilot User Guide                                  | https://docs.px4.io/                                                                                                   |
| MAVSDK (Python)                                           | https://mavsdk.mavlink.io/                                                                                             |
| Protocolo MAVLink                                         | https://mavlink.io/                                                                                                    |
| Documentación Holybro (todos los componentes)             | https://docs.holybro.com/                                                                                              |
| Guía de armado X500 V2 (PDF)                              | [Assembly Guide](https://cdn.shopifycdn.net/s/files/1/0604/5905/7341/files/X500_V2_Assembly_Guide_en.pdf?v=1720853913) |
| Manual SIYI A8 mini (PDF)                                 | [User Manual v1.10](https://siyi.biz/siyi_file/A8%20mini/A8%20mini%20User%20Manual%20v1.10%20.pdf)                     |
| QGroundControl                                            | https://qgroundcontrol.com/                                                                                            |
| Simulación PX4 SITL + Gazebo (nuestro entorno de pruebas) | https://docs.px4.io/main/en/simulation/                                                                                |
| Repositorio del proyecto                                  | https://github.com/ThiagoGonzalezz/aero-inspect                                                                        |

---

## 5. Seguridad

- **Nunca** trabajar en banco con las hélices instaladas. Se colocan recién para las pruebas de vuelo.
- Las LiPo se cargan supervisadas, con cargador balanceador y dentro de bolsa ignífuga. No descargar por debajo de ~3.5 V/celda.
- Antes de cada vuelo: chequeo de hélices (sentido y ajuste del retenedor), tornillería, estado de batería y calibración de brújula si se cambió la ubicación de componentes.
- Configurar en PX4 los **failsafes** de batería baja, pérdida de RC y pérdida de datalink antes del primer vuelo.

---

_Nota para el equipo: cuando el dron esté armado, reemplazar las fotos pendientes (GPS, PDB, batería y Raspberry Pi) por fotos reales de nuestras unidades en la carpeta `docs/img/` del repo, para no depender de links externos._

---

## 6. Por qué el simulador equivale a usar el dron

Toda la arquitectura de software descrita en este documento gira alrededor de **PX4** y del protocolo **MAVLink**, no del hardware físico en sí. El [simulador PX4 con Docker + QGroundControl](../simulador/instalacion.md) corre exactamente el mismo firmware PX4 Autopilot que corre en la Pixhawk 6C real, dentro de un motor de física (Gazebo) que emula el comportamiento de un cuadricóptero.

Esto tiene consecuencias directas para el desarrollo del proyecto:

- **Mismo firmware, misma lógica de vuelo.** El PX4 Autopilot que ejecuta la Pixhawk 6C (sección 2.2) es el mismo binario que corre dentro del contenedor del simulador. No hay una versión "simulada" distinta del código de vuelo.
- **Mismo protocolo de comunicación.** El simulador expone MAVLink por UDP (puerto 14550), igual que lo hace la Pixhawk a través del radio SiK (sección 2.5) o del enlace serial con la Raspberry Pi (`TELEM2`). El Módulo de Control de Vuelo (Python/MAVSDK) que corre en la Pi (sección 2.8) le habla al simulador exactamente igual que le hablaría al dron real.
- **Misma herramienta de monitoreo.** QGroundControl se conecta al simulador de la misma forma que se conectaría al dron real vía radio SiK: no requiere configuración distinta.
- **Vehículo configurable.** El parámetro `VEHICLE` del simulador permite elegir `iris` (cuadricóptero), que reproduce el comportamiento de vuelo de un frame como el X500 V2, incluyendo despegue, hover, waypoints y aterrizaje.

En la práctica, esto significa que todo el desarrollo, prueba y validación del Módulo de Control de Vuelo, la lógica de misiones y la integración MQTT ↔ MAVLink puede hacerse contra el simulador sin necesidad de tener el dron armado ni de volar físicamente. El dron real solo se vuelve indispensable para validar aspectos que el simulador no reproduce: la cámara SIYI A8 mini y su integración por Ethernet, el consumo real de batería, el comportamiento del GPS/brújula en campo, y el enlace de radio SiK en condiciones reales.
