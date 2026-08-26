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

## Qué sigue

1. Confirmar con desarrollo el flujo de auth de la API de Certificación
   (bloquea todo lo 🟡).
2. Empezar por **Invitaciones**: es 100% API, sin hardware de por medio —
   el primer caso 🟡 real que se puede pasar a 🟢 sin depender de un
   endpoint nuevo por crear.
3. En paralelo, pedir a desarrollo la spec de "simular evento de
   lectura + leer resultado" para un periférico (probablemente QR, es el
   más simple) — eso desbloquea todo el bloque de periféricos de acceso.
4. Recién ahí decidir si conviene que `automation/` alimente resultados de
   vuelta a QA LabFlow (ej. pre-marcar una prueba como Pass si el chequeo
   automático dio OK, dejando que el técnico solo confirme/corrija) — no
   construir esa integración antes de tener checks reales que valga la pena
   inyectar.
