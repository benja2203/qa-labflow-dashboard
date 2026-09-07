# Roadmap de automatización — QA Smartki

Este documento define, prueba por prueba (`src/data/deviceCatalog.jsx`), qué
tan automatizable es cada una hoy. Objetivo: dejar de testear a mano lo que
se pueda verificar por API/red, y enfocar el tiempo humano en lo que
realmente requiere estar frente al hardware.

Categorías:

- 🟢 **Automatizable ya** — no depende de nada nuevo del equipo de desarrollo.
- 🟡 **Automatizable con API** — viable, pero depende de que desarrollo
  confirme/exponga un endpoint (ver `automation/README.md` para el detalle
  de qué falta).
- 🔴 **No automatizable** — requiere presencia física o percepción humana
  (audio, imagen, ergonomía) que no tiene sentido simular.

## Controlador

| Prueba | Categoría | Nota |
|---|---|---|
| Equipo encendido y con LED de estado normal | 🔴 | Percepción visual en sitio. |
| Conexión a red LAN/WiFi activa y estable | 🟢 | **Ya implementado** — `automation/` chequea que los servicios cloud respondan. Confirma el lado cloud; la estabilidad de la LAN local igual se valida en sitio. |
| Hora y zona horaria configuradas correctamente | 🟡 | Si hay endpoint de estado del controlador que devuelva hora local, se compara contra hora real. |
| Periféricos configurados correctamente desde el dashboard | 🟡 | Se puede validar por API/DB que la config cargada en Cooper coincide con la topología declarada en QA LabFlow (cruce de datos), sin tocar hardware. |
| Servicios Smartki activos después de reinicio controlado | 🟡 | Necesita endpoint de estado/keep-alive por controlador (ver roadmap Jira "Monitor de comunidades"). |

## Lector QR / StickerTag / LPR / Facial (periféricos de acceso)

Patrón común a los 4: "encendido y conectado" es 🟡 (depende de estado del
dispositivo), "válido → concedido" / "inválido → denegado" / "vencido →
denegado" son 🟡 en conjunto (necesitan un endpoint para *simular* el
evento de lectura y leer el resultado), "abre el relé correspondiente" es
🟡 (idealmente el mismo endpoint devuelve si el relé se activó, sin
necesidad de verlo físicamente), "queda registrado en dashboard" es 🟢
**una vez que exista el endpoint anterior** (es solo leer el log de
actividad después del evento simulado, que si es API 2.0 con
`api.activities.*` ya documentado en Confluence).

Casos que quedan 🔴 pase lo que pase, porque dependen de condiciones físicas
reales que automatizar sería simular, no probar: "brillo bajo / mica
reflectante", "baja iluminación", "mascarilla/lentes", "screenshot/captura
de QR" (esto es justamente probar que el sistema detecta una *foto*, no un
QR físico — haría falta una cámara real).

## Smartki Guard (Desk/PDA), Control Remoto, Hard Button, Monitor

Todo lo que es UI/flujo de la app (formulario de visita, impresión de QR,
selección de puerta, panel en tiempo real) es 🔴 hoy — requeriría
automatización de UI (ej. Appium/Playwright sobre la app Android/tótem), que
es una automatización de *software* distinta a la de *hardware* y no está en
alcance de este roadmap. La apertura de puerta/relé disparada desde estos
dispositivos es 🟡 con el mismo endpoint de simulación de evento que arriba.

## Invitaciones / QR Carnet (módulos)

Generación/revocación de invitación y validación de rango horario son 🟡:
son llamadas a la API de invitaciones (que sí es HTTP documentado, `api.v3.*`),
así que en teoría son las más simples de automatizar de todo el catálogo una
vez que se resuelva el auth de la API — no dependen de hardware físico en
absoluto, son puramente backend.

## Actualización (26-ago-2026): estado real de las 3 preguntas bloqueantes

Después de consultar y de buscar en Confluence/Jira, las tres preguntas de
la sección anterior quedaron así — ya no son tres incógnitas iguales:

1. **Auth contra la API de Certificación — ✅ resuelto.** Existe un
   endpoint para autenticarse en un ambiente específico y es conseguible.
   Con esto `automation/` puede empezar a llamar la API de verdad (no solo
   el health check no autenticado que hace hoy).

2. **Estado online por dispositivo individual (QR, cámara, antena
   StickerTag) — ❌ no existe un endpoint dedicado, pero no hace falta
   pedir uno.** Confirmado: hay forma de saber si un *controlador* está
   online, pero no de un periférico individual vía un endpoint de
   "ping"/estado. Búsqueda alternativa: hay un campo `status` en la tabla
   `device` de la BD local del controlador (ver Confluence "Checklist paso
   a producción"), pero es un chequeo de que el dispositivo quedó bien
   *aprovisionado*, no una señal de online/offline en tiempo real, y se
   consulta por SQL directo, no por API — no sirve para esto.

   **Mejor enfoque, propuesto por el usuario: inferir el estado por el
   efecto colateral de la prueba funcional real (③), sin pedirle nada
   nuevo a desarrollo.** Una vez que exista el endpoint de "simular
   lectura" (③) para un dispositivo, ese mismo llamado ya revela si está
   online: si responde con una decisión de negocio (concedido/denegado/
   código de rechazo), el dispositivo está vivo — la lectura tuvo que
   llegar hasta él y volver; si da timeout o un error de "no
   responde"/"inalcanzable", está offline. Esto colapsa la pregunta ② en
   la ③: no es una prueba aparte, es una lectura del resultado que la
   prueba de acceso ya te da gratis. Vive enteramente en `automation/`
   (lógica de interpretación de la respuesta), cero trabajo adicional para
   el equipo de desarrollo.

3. **Simular un evento de lectura por API — ✅ ya existe, no hay que
   pedirle a desarrollo que construya nada.** Corrección sobre lo que decía
   antes esta sección: `ParkBridgeServer` (Smartki Park) fue el ejemplo que
   encontré primero, pero **no es el que hay que usar** — es un puente
   nuevo, en desarrollo, y específico de estacionamientos.

   Lo que sí aplica directo a comunidades (`deviceCatalog.jsx`): el
   monolito `smartki_v_2_0` — el que corre en **cada controlador de
   comunidad**, no solo en Park — ya tiene un proceso HTTP dedicado por
   cada método de acceso, corriendo hoy en producción:
   - **LPR**: `LprServer.js`, puerto 5004, `POST /smartki_lpr/api/v1/
     OnCarHandledHikvision` (y V2) — recibe la patente leída por la
     cámara y la valida contra la BD local del controlador.
   - **QR**: microservicio `ms-smartki-qr` — "entrega una rápida
     respuesta de OK/NOK" para lectores QR y reconocimiento facial.
   - **StickerTag**: `AntennaRS485Receiver.js` — escucha los eventos de
     la antena (`AntenaId`, `tag`, `event` entrada/salida, `timestamp`).

   Estos son los mismos servicios que reciben la lectura real cuando un
   residente pasa su QR o su tag — el hardware físico les pega a ellos.
   **No hay endpoint que crear**, hay que pedir documentación/acceso a los
   que ya están corriendo.

   **Dos preguntas puntuales que sí hay que hacer, ninguna es "desarrollen
   algo nuevo":**
   - ¿Cuál es el contrato exacto de cada uno (payload, respuesta, cómo se
     distingue "concedido" de "denegado" de "error interno")? Para LPR ya
     tengo el endpoint y el puerto; para QR y StickerTag falta el detalle
     fino.
   - **Crítica de seguridad**: ¿alguno de estos tiene (o se le puede
     agregar) un modo "solo validar, sin accionar el relé"? El puente de
     Park sí lo tiene (`ParkBridgeServer` lo llama "flag solo-validar sin
     relé", tarea M2 de ese proyecto) precisamente porque probar sin eso
     abriría la puerta/barrera de verdad. Sin confirmar esto, automatizar
     pruebas en una instalación real podría abrir puertas físicas en
     producción — no se puede avanzar a probar contra hardware real sin
     esta respuesta.

   **Restricción de red importante**: estos servicios corren en la red
   local del sitio (`http://CONTROLLER_IP:puerto`, ej. `10.20.20.3:5004`),
   no son alcanzables desde internet. Esto cambia cómo se ejecuta
   `automation/` — ver `IMPLEMENTATION_PLAN.md`.

## Qué sigue

1. ~~Confirmar con desarrollo el flujo de auth~~ — resuelto, conseguir la
   credencial y cargarla en `automation/.env`.
2. Empezar por **Invitaciones**: sigue siendo el candidato más simple —
   100% API, sin hardware ni endpoints nuevos de por medio.
3. Pedir a desarrollo el contrato de `LprServer`/`ms-smartki-qr`/
   `AntennaRS485Receiver` (payload y respuesta exactos) y confirmar el
   modo "solo validar, sin relé" — no es pedir una feature nueva, es
   documentación + una confirmación de seguridad sobre servicios que ya
   corren en producción. Es lo único que sigue pendiente de desarrollo.
4. ~~Estado online de dispositivo individual como pregunta aparte~~ — ya
   no es una pregunta a desarrollo: se infiere del resultado de (3) (ver
   sección anterior). Cuando (3) esté resuelto, esto sale gratis, no
   requiere ningún trabajo adicional.
5. Recién con (3) resuelto, decidir si conviene que `automation/` alimente
   resultados de vuelta a QA LabFlow — no construir esa integración antes
   de tener checks reales que valga la pena inyectar.
