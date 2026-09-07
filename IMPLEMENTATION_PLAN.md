# Plan de implementación — Automatización QA (Opción 3)

Este documento asume la decisión ya tomada en `ARCHITECTURE_DECISION.md`
(orquestador liviano, sin base de datos propia, sobre Cooper + los
servicios de cada controlador). Acá está el cómo: stack, arquitectura de
ejecución, estructura de código, flujo de datos y plan por hitos.

## 0. El cambio de modelo que fuerza todo lo demás: dónde corre `automation/`

Esto no estaba bien en la primera versión del plan y hay que corregirlo
antes de elegir tecnología: **`automation/` no puede ser un servicio
hosteado en un servidor cualquiera con salida a internet.**

Los tres servicios que reciben la lectura de cada método de acceso
(`LprServer.js` puerto 5004, `ms-smartki-qr`, `AntennaRS485Receiver.js`)
corren **en el controlador físico de cada sitio**, escuchando en su IP de
red local (ej. `http://10.20.20.3:5004`). No son alcanzables desde
internet — ni deberían serlo, es la red interna de la instalación.

Consecuencia directa: para simular una lectura contra un controlador real,
el proceso que hace esa llamada HTTP tiene que estar **conectado a la
misma red local que el controlador**, en el momento de la visita. Esto en
realidad simplifica las cosas respecto a lo que se planteaba antes:

- **No hace falta hostear nada.** Nada de servidor 24/7, nada de decidir
  dónde vive en la nube. `automation/` es una **herramienta de línea de
  comandos (CLI) que el técnico corre desde su propia laptop**, conectado
  al Wi-Fi/LAN del sitio, en el mismo momento en que hoy hace las pruebas
  manuales.
- **No hay superficie nueva expuesta a internet.** Las credenciales viven
  en el `.env` de la laptop del técnico durante la visita, igual que hoy
  Cooper o cualquier otra herramienta requiere login del técnico en sitio.
- Las llamadas a **Cooper** (topología) y a la **API de Smartki** (auth)
  sí son por internet normal — esas se pueden hacer desde cualquier lado,
  incluso antes de llegar al sitio, para preparar la visita.

Esto convierte a `automation/` en algo más parecido a un script/CLI de
apoyo a la visita técnica que a un "backend" — más simple de construir,
desplegar (no hay que desplegar nada, se clona y se corre) y de razonar en
términos de seguridad.

## 1. Stack tecnológico

| Pieza | Elección | Por qué |
|---|---|---|
| Runtime | Node.js (ya arrancado en `automation/`) | Mismo lenguaje que el resto de Smartki (NestJS/Express) — si desarrollo tiene que revisar algo, no es un lenguaje ajeno. Cero curva de aprendizaje nueva para vos, que ya trabajás con el repo de QA LabFlow en JS. |
| HTTP | `fetch` nativo (Node ≥18) | Ya viene con Node, sin dependencia extra. Alcanza para lo que hace falta: GET/POST con headers y timeout. |
| Config | `dotenv` (ya en `package.json`) | Estándar, minúsculo, ya está. |
| CLI | `node:util.parseArgs` (nativo) en vez de una librería tipo `commander` | Un solo comando con 1-2 argumentos (`--community`, `--method`) no justifica una dependencia. |
| Tests | `node:test` + `node:assert` (nativos) | Cero dependencias nuevas. Alcanza para probar la lógica pura (armar payloads, interpretar respuestas) sin tocar red real. |
| Reportes | JSON plano a disco (ya implementado en `automation/reports/`) | Ya es legible por humanos y por un futuro import a QA LabFlow. No hace falta una base de datos para esto — es el historial de una visita, no un sistema transaccional. |

**Deliberadamente NO se usa**: un framework web (Express/Fastify/NestJS)
porque no hay que exponer nada — `automation/` solo hace llamadas salientes,
nunca recibe tráfico entrante. Tampoco una base de datos — el estado que
importa (la topología) vive en Cooper, no acá.

## 2. Arquitectura objetivo

```
                         ANTES DE LA VISITA (con internet, desde cualquier lado)
                         ───────────────────────────────────────────────────────
                         automation/ ──login──▶ API Smartki (token)
                         automation/ ──GET /devices?community=X──▶ Cooper
                                                     │
                                                     ▼
                                     topología completa de la comunidad
                                     (tipos, cantidades, deviceKey, IP de
                                      cada controlador — variable por sitio)


                         DURANTE LA VISITA (laptop del técnico, en la LAN del sitio)
                         ───────────────────────────────────────────────────────
                         automation/ recorre cada instancia de la topología:

                           QR       ──POST http://CONTROLLER_IP:PUERTO_QR/...──▶ ms-smartki-qr
                           LPR      ──POST http://CONTROLLER_IP:5004/smartki_lpr/api/v1/OnCarHandledHikvision──▶ LprServer.js
                           StickerTag ──(según contrato a confirmar)──▶ AntennaRS485Receiver.js

                         Cada respuesta se clasifica:
                           concedido/denegado/código de rechazo → dispositivo ONLINE, resultado de la prueba
                           timeout / connection refused          → dispositivo OFFLINE

                                                     │
                                                     ▼
                                     Reporte JSON por instancia (local, en la laptop)
                                                     │
                                                     ▼
                                 (fase futura, no en el alcance inicial)
                                 el técnico revisa el reporte y carga a mano en
                                 QA LabFlow lo que corresponda — sin integración
                                 automática todavía
```

## 3. Estructura de código propuesta

```
automation/
├── .env.example
├── package.json
├── README.md
├── reports/                      (gitignored — un JSON por corrida)
└── src/
    ├── config.js                 (ya existe)
    ├── cli.js                    (nuevo — parseo de argumentos, entrypoint)
    ├── clients/
    │   ├── smartkiAuthClient.js  (nuevo — login, cache de token en memoria)
    │   ├── cooperClient.js       (nuevo — GET topología de una comunidad)
    │   └── controllerClient.js   (nuevo — POST a IP local del controlador,
    │                              con timeout configurable)
    ├── methods/                   (un módulo por tipo de periférico —
    │                              así se agregan métodos sin tocar el resto)
    │   ├── qr.js                 (arma payload QR, interpreta respuesta)
    │   ├── lpr.js                (arma payload LPR — patente sintética)
    │   └── stickertag.js         (arma payload StickerTag)
    ├── runCommunityCheck.js      (orquesta: topología → loop → methods/* → reporte)
    └── checks/
        └── environmentHealth.js  (ya existe — chequeo de salud cloud)
└── test/
    ├── methods/
    │   ├── qr.test.js            (payload/interpretación, sin red real)
    │   ├── lpr.test.js
    │   └── stickertag.test.js
    └── clients/
        └── controllerClient.test.js  (timeout → offline, respuesta → online)
```

**Por qué un módulo por método (`methods/qr.js`, `lpr.js`, `stickertag.js`)
en vez de una función genérica**: cada uno tiene payload distinto (QR:
código crudo; LPR: patente + imagen opcional; StickerTag: tagId) y su
propia forma de decidir concedido/denegado. Aislarlos por archivo es lo que
permite agregar Facial más adelante sin tocar QR, y es exactamente el
mismo patrón que ya usa `deviceCatalog.jsx` en la SPA (un objeto por tipo
de dispositivo) — consistencia entre los dos proyectos.

## 4. Flujo de datos, en detalle

1. **Auth** (`smartkiAuthClient.js`): login contra la API de Certificación
   con las credenciales de `.env`. Token en memoria, se refresca si el
   siguiente llamado da 401.
2. **Topología** (`cooperClient.js`): `GET` a Cooper por `communityId`.
   Devuelve la lista real de controladores e instancias — acá es donde
   entra la variabilidad (2 controladores o 40, no importa).
3. **Identificación por instancia**: cada instancia de la respuesta de
   Cooper trae (a confirmar el shape exacto): tipo (`qr`/`lpr`/
   `stickertag`), `deviceKey` o `gateId`, la IP del controlador al que
   pertenece, y el puerto del servicio correspondiente.
4. **Ejecución por tipo** (`methods/*.js` + `controllerClient.js`): por
   cada instancia, el módulo del tipo correspondiente arma un payload
   sintético (ej. QR: un código de prueba previamente registrado en
   Cooper como válido, para poder esperar "concedido"; LPR: una patente de
   prueba) y lo postea a `http://<IP del controlador>:<puerto>/<ruta>`.
5. **Clasificación de la respuesta**: cada módulo interpreta el resultado
   según el contrato real (a confirmar con desarrollo) en una de 3
   categorías: `resultado_negocio` (concedido/denegado/código de rechazo —
   dispositivo online), `timeout_u_offline` (no responde — dispositivo
   posiblemente offline o inalcanzable desde la red del técnico), `error`
   (algo no esperado, se reporta tal cual para revisión manual).
6. **Reporte**: un JSON por corrida en `automation/reports/`, con un
   registro por instancia (tipo, puerta, resultado, duración, timestamp).

## 5. Requisito de seguridad que bloquea probar contra hardware real

Antes de correr esto contra una instalación real (no un banco de pruebas),
hay que tener confirmado: **¿estos endpoints tienen un modo que valide sin
accionar el relé físico?** El proyecto de Park resolvió esto con un "flag
solo-validar" a propósito porque sin él, cada prueba simulada abriría la
puerta o barrera de verdad. Si `LprServer`/`ms-smartki-qr`/
`AntennaRS485Receiver` no tienen ese modo hoy, no se puede avanzar a probar
contra una instalación real hasta que exista — sí se puede seguir
desarrollando y probando contra un banco de pruebas de hardware (ver hito
2 abajo).

## 6. Plan por hitos

**Hito 1 — Fundamentos (sin depender de nadie), ya se puede empezar hoy**
- `smartkiAuthClient.js`: login real contra Certificación con la
  credencial que ya se puede conseguir.
- `cooperClient.js`: traer la topología real de una comunidad de prueba.
- Reemplazar el chequeo de salud actual para que use el token real en vez
  de pegarle a las URLs sin autenticar.
- Tests unitarios de `methods/*` con respuestas de ejemplo (mockeadas) —
  esto no depende de tener el contrato real todavía, se arranca con la
  forma más probable y se ajusta después.

**Hito 2 — Contrato confirmado + banco de pruebas (depende de desarrollo)**
- Reunión corta con desarrollo: contrato exacto de los 3 servicios +
  confirmación del modo "solo validar" (sección 5).
- Probar `methods/qr.js` end-to-end contra un controlador de banco de
  pruebas (no una instalación con clientes reales).
- Ajustar la clasificación de respuestas (`resultado_negocio` vs
  `timeout`) según los códigos reales que devuelva cada servicio.

**Hito 3 — Cobertura del resto de métodos**
- `lpr.js` y `stickertag.js` con el mismo patrón ya validado en QR.
- Facial queda para después: comparte lector QR integrado (`deviceCatalog.jsx`
  ya lo modela así), se resuelve reutilizando `methods/qr.js` con un flag.

**Hito 4 — Piloto en una instalación real**
- Una visita real, corriendo `automation/` desde la laptop del técnico en
  paralelo al checklist manual de QA LabFlow, comparando resultados.
- Definir recién ahí si vale la pena la integración con QA LabFlow (Fase 3
  de `ARCHITECTURE_DECISION.md`) — no se construye antes de validar que el
  dato automatizado es confiable en terreno.

## 7. Lo que se necesita de terceros, resumido

- **De desarrollo**: contrato de `LprServer`/`ms-smartki-qr`/
  `AntennaRS485Receiver` + confirmación del modo "solo validar sin relé".
  No es una feature nueva, es documentación y una respuesta de seguridad
  sobre algo que ya existe.
- **De vos/operación**: una comunidad de banco de pruebas con hardware real
  disponible para el Hito 2, y acceso (usuario/clave) a Cooper y a la API
  de Certificación.
- **Nada de infraestructura nueva**: no hay servidor que levantar, ni
  dominio, ni certificado — es un repo que se clona y un `.env` que se
  completa en la laptop del técnico.
