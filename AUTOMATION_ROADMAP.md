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
   StickerTag) — ❌ no existe.** Confirmado: hay forma de saber si un
   *controlador* está online, pero no de un periférico individual. No es
   que falte documentación, es que no está construido. Esta prueba puntual
   ("lector encendido y conectado") **sale del alcance de automatización
   por ahora** — se sigue verificando a mano hasta que exista esa señal.

3. **Simular un evento de lectura por API — 🟡 hay precedente real, pero
   acotado.** Encontré el contrato exacto en Confluence
   ("Unificación Smartki Park: Convenio + Transiente — Puente
   multi-método", página 924155905): un servicio nuevo (`ParkBridgeServer`)
   expone `POST /bridge/api/v1/validate/lpr` (acepta patente + imagen en
   base64 opcional), `/validate/qr`, `/validate/nfc` y `/validate/sticker`,
   todos devolviendo `{status, code, message}` — exactamente el patrón
   "inyectar una lectura, leer el resultado" que hace falta.

   **Importante — esto es de Smartki Park (estacionamientos), no del
   control de acceso de edificios/comunidades que testeás vos:**
   - Es parte de un proyecto nuevo para unificar Smartki Park Convenio y
     Transiente, **en desarrollo activo ahora mismo** (arrancó 22-jul-2026,
     LPR y QR se programaron primero, NFC y StickerTag se están
     construyendo la semana del 27-ago al 03-sep-2026, desarrollo completo
     recién el 04-sep-2026, QA hasta el 30-sep-2026, piloto en producción
     el 06-oct-2026).
   - El endpoint valida contra la lógica de "convenio" de un
     estacionamiento (vigencia, blacklist, cupos), no contra el control de
     acceso general de una comunidad residencial/edificio.
   - No confirma que exista (o vaya a existir) un endpoint equivalente
     para el catálogo de periféricos de `deviceCatalog.jsx` (QR/StickerTag/
     LPR/Facial de acceso general).

   Sí confirma algo valioso: el patrón "endpoint que recibe una lectura
   simulada y devuelve la decisión" **es un patrón que Smartki ya usa y
   sabe construir** — no es una idea rara. La pregunta puntual que falta:
   ¿existe o se puede pedir un endpoint equivalente para el flujo de acceso
   general (no parking)?

## Qué sigue

1. ~~Confirmar con desarrollo el flujo de auth~~ — resuelto, conseguir la
   credencial y cargarla en `automation/.env`.
2. Empezar por **Invitaciones**: sigue siendo el candidato más simple —
   100% API, sin hardware ni endpoints nuevos de por medio.
3. Preguntar puntualmente si existe un endpoint de "simular lectura +
   resultado" para el control de acceso general (no Park) — con el
   precedente de `ParkBridgeServer` como referencia concreta de qué pedir.
4. Dejar la prueba "dispositivo individual online" fuera de automatización
   hasta que desarrollo construya esa señal — no es un bloqueo temporal,
   es una feature que no existe.
5. Recién con (3) resuelto, decidir si conviene que `automation/` alimente
   resultados de vuelta a QA LabFlow — no construir esa integración antes
   de tener checks reales que valga la pena inyectar.
