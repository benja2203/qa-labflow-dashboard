# QA LabFlow Dashboard — Contexto para IA

Este documento existe para que otra sesión de IA (Claude, ChatGPT, lo que sea)
entienda de una este proyecto sin tener que redescubrir todo leyendo el
historial de git commit por commit. Pegalo entero como primer mensaje/contexto
en la sesión nueva.

## Qué es este proyecto

QA LabFlow es una **SPA sin backend** (React 18 + Vite 5 + Tailwind CSS,
persistencia 100% en `localStorage` del navegador) que genera un checklist de
QA dinámico para testear instalaciones del sistema de control de acceso
**Smartki** (producto de **Scharfstein**). Un técnico de QA carga la topología
de una instalación (controladores, puertas, periféricos, módulos, reglas), la
app genera automáticamente qué pruebas hay que ejecutar, permite marcarlas
Pass/Fail/Blocked/N/A, agregar comentarios/evidencia, y exportar un reporte
(pantalla y PDF).

- **Repo GitHub**: https://github.com/benja2203/qa-labflow-dashboard (rama
  `master`, sin PRs, se commitea y pushea directo).
- **Ruta local** (en la máquina donde se trabajó hasta ahora):
  `/home/baraya/Documentos/SCHARFSTEIN/Documentos/Scharfstein QA/back/Documentos a guardar/Desarrollos Scharfstein/qa-labflow-dashboard-compact-pdf-modulos-opcionales/`
- **Sin backend es una decisión de diseño deliberada**, no una limitación
  temporal. Todo vive en `localStorage` de un único navegador. Esto importa
  para cualquier feature nueva: nada se sincroniza entre técnicos ni entre
  máquinas (ver "Reporte General" más abajo, que es explícitamente
  local-only).
- Usuario de este proyecto: QA en Scharfstein, testea instalaciones del
  producto Smartki, trabaja con Jira. Prefiere que se le den opiniones
  directas y se le pregunte solo lo que es una decisión de negocio real, no
  que se le pida confirmación de cosas obvias.

## Reglas y convenciones que hay que respetar sí o sí

1. **Palabra prohibida: "Modberry"**. Nunca usarla en texto visible, label,
   comentario de UI ni string. El controlador se llama simplemente
   "Controlador". Hay una constante ofuscada
   `['mod', 'berry'].join('')` en `App.jsx` solo para migración de datos
   legacy — no tocarla ni "limpiarla".
2. **Los IDs de las pruebas son posicionales**: `community-{communityId}-{baseId}-test-{index}`,
   donde `index` es la posición dentro del array `tests` de cada dispositivo
   en `deviceCatalog.jsx`. Esto significa que **nunca hay que insertar o
   reordenar pruebas en el medio de un array `tests` existente** — siempre
   agregar pruebas nuevas **al final**. Si se inserta en el medio, los
   resultados ya guardados (Pass/Fail/comentarios) de instalaciones
   existentes quedan pegados al índice equivocado y aparecen mezclados con
   una prueba distinta a la que realmente se contestó. Esto no está
   validado por código, es una convención que hay que mantener a mano. Ya
   pasó un bug real relacionado a esto (ver StickerTag/Anti-Passback más
   abajo, aunque en ese caso el problema fue otro: agregar tests a un
   dispositivo que no debía recibirlos).
3. **`npm run build` antes de dar por terminado cualquier cambio.** Es la
   única verificación automática que hay (no hay tests, no hay lint
   configurado que se corra en CI). No hay navegador headless disponible en
   el entorno de Claude Code usado hasta ahora (no está instalado
   `chromium-cli`), así que la verificación fue siempre: build limpio +
   `npm run dev` levantando sin errores en consola — nunca se pudo confirmar
   visualmente con captura de pantalla. Si la sesión nueva sí tiene esa
   capacidad, usarla es mejor que lo que se hizo hasta ahora.
4. **Después de cada cambio, commitear y pushear a GitHub** (`git add` de los
   archivos tocados explícitamente, nunca `-A` a ciegas; commit con mensaje
   descriptivo en español explicando el *por qué*; `git push origin master`).
   Esto lo pidió el usuario explícitamente a mitad de la sesión anterior y
   se mantuvo desde ahí. `gh` CLI ya está autenticado en esta máquina; si
   `git push` falla pidiendo contraseña por un askpass gráfico que no existe
   en el entorno, correr `gh auth setup-git` y reintentar (ya pasó una vez,
   así se resolvió).
5. No usar `git push --force`, `git reset --hard` ni nada destructivo sin
   pedir confirmación explícita primero.

## Modelo de datos (resumen — ver `deviceCatalog.jsx` y `App.jsx` para el detalle)

```
community = {
  id, name, technicianName, installerName,
  modules: string[],              // ['invitaciones', 'remoto', 'qrcarnet']
  rules: {
    antipassback: bool, antipassbackDoorIds: string[],
    multivalidation: bool, multiFactors: string[],
    cancelInvitation: bool, cancelInvitationDoorIds: string[],
  },
  nodes: [{                       // cada nodo = un controlador físico
    id, type: 'controller', label,
    doors: [{ id, name, zone, type }],
    peripherals: [{
      type: 'qr'|'stickertag'|'lpr'|'facial'|'guardDesk'|'guardPda'|'hardbutton',
      qty,
      instances: [{
        id, label, doorId, direction, port, portNote, ip,
        relaySource, relays[], relayNote, actionSeconds,
        cameraEnabled, cameraIp,       // solo qr y stickertag
        cardReaderEnabled,             // solo guardDesk (lector externo de carnet por deslizamiento)
      }],
    }],
  }],
}
```

**Catálogo de dispositivos** (`src/data/deviceCatalog.jsx`, objeto
`DEVICE_CATALOG`): cada entrada tiene `id`, `name`, `role`
(`controller`|`peripheral`|`optionalModule`), `phase`, `icon`, `tests: []`
(array de strings, orden importa — ver regla #2 arriba).

- **Periféricos** (`role: 'peripheral'`): `qr`, `stickertag`, `lpr`, `facial`,
  `guardDesk`, `guardPda`, `hardbutton`.
- **Módulos opcionales** (`role: 'optionalModule'`): `invitaciones`,
  `remoto`, `qrcarnet` (este último con `tests: []`, ver más abajo por qué).

## Archivos clave

| Archivo | Qué hace |
|---|---|
| `src/App.jsx` | Estado global (todo vive acá vía `useLocalStorageState`), normalización/migración de datos legacy, import/export JSON, wiring de todos los handlers hacia los componentes. |
| `src/data/deviceCatalog.jsx` | Catálogo de dispositivos/módulos y sus pruebas base. |
| `src/constants/accessConfig.js` | Tipos de puerta, opciones de relé/puerto, `CAMERA_CAPABLE_TYPES`, `CARD_READER_CAPABLE_TYPES`, `DEFAULT_INSTANCE_LINK`. |
| `src/constants/testStatus.js` | Enum de estado de prueba (`pending/pass/fail/blocked/na`) con labels y clases Tailwind. |
| `src/constants/observationScopes.js` | `PROCESS_SCOPE` ("Proceso/Documentación") + resolver de labels de alcance para Observaciones Generales. |
| `src/constants/observationStatus.js` | Estado de una Observación General: `pending`/`in_review`/`resolved`, con resolver compatible con datos viejos (que solo tenían `resolved: boolean`). |
| `src/utils/checklist.js` | `buildChecklistByPhases(community)`: arma el checklist completo a partir de topología + reglas + catálogo. Toda la lógica de inyección dinámica de pruebas (Anti-Passback, Cancelar Invitación, Multivalidación, Cámara IP, Lector de Carnet, `[Carnet]`/`[Invitaciones]` en QR/Facial) vive acá. También `stripIconsForSnapshot`/`hydrateSnapshotIcons` (para el snapshot de proyecto cerrado, ver abajo). |
| `src/utils/checklistFilters.js` | Filtrado del checklist por Estado/Fase/Dispositivo + cálculo de progreso por chip. |
| `src/utils/report.js` | `createChecklistSummary`, `getReportIssues` (con soporte de notas de dispositivo), `hasChecklistFailuresWithoutComment`, `getTechnicalDeviceReport` (ficha técnica puertas/relés), `buildReportPayload` (para exportar JSON). |
| `src/utils/generalReport.js` | Agregado cross-comunidad (todas las comunidades de este navegador): defectos por tipo de dispositivo, pruebas que más fallan, observaciones generales consolidadas. |
| `src/utils/pdfReport.js` | Generación de PDF con `jsPDF` (reporte por comunidad, reporte general, ficha técnica). Usa un mini "writer" propio (`createPdfWriter`) para no repetir boilerplate de layout. |
| `src/components/Sidebar.jsx` | Menú izquierdo: comunidades, Nueva Comunidad, Importar JSON, Reporte General. |
| `src/components/CommunityForm.jsx` | Formulario de topología (controladores, puertas, periféricos, módulos, reglas). |
| `src/components/Dashboard.jsx` | Vista principal de una comunidad: header/estado, filtros, Observaciones Generales, Excepción de Entrega, banner de Proyecto Cerrado, lista de fases/dispositivos. |
| `src/components/PhaseSection.jsx` / `DeviceCard.jsx` / `TaskRow.jsx` | Jerarquía de render del checklist. `DeviceCard` tiene el banner de "Nota de dispositivo" y el botón "Marcar como…" en bloque. |
| `src/components/ApprovalPanel.jsx` | Semáforo de aprobación automático (APTO/NO APTO/BLOQUEADO/EN PROGRESO). |
| `src/components/ChecklistFilters.jsx` | Chips de filtro por Estado/Fase/Dispositivo con indicador de progreso. |
| `src/components/GeneralObservations.jsx` | Notas generales (no atadas a una prueba puntual), con alcance y estado de 3 vías. |
| `src/components/DeliveryDecision.jsx` | "Entregado bajo excepción" — decisión de negocio separada del estado técnico. |
| `src/components/TechnicalSheetModal.jsx` / `ReportModal.jsx` | Ficha técnica y reporte final (pantalla). |
| `src/components/GeneralReportView.jsx` | Pantalla de Reporte General (agregado cross-comunidad). |

## LocalStorage keys en uso

`qa-labflow-communities`, `qa-labflow-selected-community`,
`qa-labflow-task-results`, `qa-labflow-general-observations`,
`qa-labflow-delivery-exceptions`, `qa-labflow-closed-projects`,
`qa-labflow-device-notes`.

## Qué se construyó en la sesión anterior (en orden aproximado)

Partiendo de una base que ya tenía: mapeo puertas/relés, ficha técnica,
aprobación automática, importar JSON — se agregó:

1. **Filtros de checklist** (Estado/Fase/Dispositivo) con indicador visual de
   progreso/completado por chip, para no tener que scrollear todo el
   checklist para ver qué falta.
2. **Observaciones Generales**: notas no atadas a una prueba puntual, con
   alcance (tipo de dispositivo, o "Proceso/Documentación" para cosas como
   "no me entregaron la plantilla de configuración"), listas para copiar a
   un ticket. Más tarde se les agregó estado de 3 vías: **Pendiente / En
   revisión / Resuelta** (reemplazó un booleano `resolved` inicial). Se
   consolidan en el Reporte General entre todas las comunidades, con conteo
   de las tres categorías.
3. **"Entregado bajo excepción"**: decisión de negocio separada
   deliberadamente del estado técnico (APTO/NO APTO/etc., que sigue
   calculándose puro). Registra quién autoriza y el motivo. Se muestra como
   badge junto al estado final, no lo reemplaza ni lo tapa.
4. **Split de Smartki Guard en `guardDesk` y `guardPda`**: eran un solo
   dispositivo, se separaron porque tienen flujos de uso y hardware
   distintos (Desk = pantalla fija con formulario de visita, impresión de
   QR, panel de apertura remota por desplegable de puertas; PDA = handheld
   que escanea el carnet, pregunta Entrada/Salida, abre una puerta
   específica o hace "registro sin apertura"). Migración automática de
   comunidades viejas (`type: 'guard'` → `'guardDesk'`). Se agregó
   `cardReaderEnabled` como flag por instancia (mismo patrón que
   `cameraEnabled`) para el lector externo de carnet por deslizamiento del
   Desk.
5. **Regla "Cancelar Invitación"** (`rules.cancelInvitation` +
   `cancelInvitationDoorIds`, configurada por puerta igual que
   Anti-Passback): la visita/invitación/carnet se invalida en el primer
   ingreso en las puertas seleccionadas; la salida siempre se permite
   (regla de negocio). Aplica siempre a `guardDesk`/`guardPda`, y a
   `qr`/`facial` solo cuando el módulo Invitaciones o Carnet está
   habilitado.
6. **Botón "Importar JSON" en el Sidebar** (antes solo se podía importar
   desde adentro de una comunidad ya seleccionada).
7. **Reporte General** (`GeneralReportView.jsx` + `generalReport.js`):
   pantalla nueva, agregado de **todas las comunidades de este navegador**
   (no cross-técnico, no hay backend). Muestra defectos por tipo de
   dispositivo, ranking de pruebas que más fallan, observaciones generales
   consolidadas, exportable a PDF. Nuevo ítem en el Sidebar, no cambia el
   comportamiento por defecto de abrir en la última comunidad.
8. **"Cerrar proyecto" / Proyecto Cerrado**: al cerrar, se guarda una
   **foto congelada** (`checklistByPhases` sin íconos + `taskResults` +
   `deviceNotes` de esa comunidad en ese momento) en
   `qa-labflow-closed-projects`. Mientras está cerrado, el checklist deja
   de recalcularse desde el catálogo en vivo — se muestra tal cual la foto,
   así cambios futuros en las pruebas no le agregan pendientes a algo ya
   entregado. Se bloquea edición de topología, reinicio de checklist y
   resultados de pruebas (modo solo lectura en `TaskRow`/`DeviceCard`).
   "Reabrir proyecto" **descarta la foto** (no hay historial de versiones,
   es un estado único que se sobreescribe) y confirma con el usuario antes
   de hacerlo. Integrado en export/import JSON con remapeo de IDs si la
   comunidad cambia de id al reimportar.
9. **Nota de dispositivo** (bulk status por dispositivo completo): en vez de
   escribir el mismo comentario en cada una de las N pruebas de un
   dispositivo (lo que inflaba mucho el reporte con texto repetido), se
   guarda **un solo registro** `deviceNotes[deviceId] = {status, comment}`.
   El estado de cada prueba individual se sigue marcando igual (para que
   progreso/filtros/aprobación sigan exactos), pero el motivo se muestra
   **una sola vez** en el reporte como "Nota de dispositivo — aplica a N
   pruebas", colapsando las pruebas cubiertas en un solo bloque. Si después
   se edita una prueba puntual de ese dispositivo por separado, esa sí
   aparece aparte con su propio detalle — no afecta la nota general.
10. **Limpieza visual del reporte final**: se sacó el branding "QA LabFlow"
    (texto + ícono) del header, el emoji de candado en "Proyecto cerrado",
    una frase redundante en el bloque de excepción de entrega, y se corrigió
    que el color del borde de cada tarjeta de "Observaciones, Fallas y
    Evidencia" derive del estado real (Fail=rojo, Blocked=ámbar, N/A=gris)
    en vez de un gris fijo para las notas de dispositivo. **Pendiente
    (mencionado pero no ejecutado)**: el usuario coincidió en que el reporte
    tiene "mucho color" — quedó abierta la idea de sacar los colores
    *decorativos* de sección (el morado de todo el bloque de Observaciones
    Generales, el naranja de fondo del panel de excepción) y dejar color
    solo donde informa algo (los badges de estado). No se hizo, es una
    posible tarea futura si el usuario la retoma.
11. **Tarjeta de conteo separada para Observaciones Generales** en el resumen
    del reporte — a propósito **no se mezcló** con el conteo existente de
    "Observaciones" (que cuenta fallas/bloqueos puntuales del checklist),
    para no conflar un número objetivo ligado al resultado técnico con notas
    más libres que pueden estar ya resueltas.
12. **Varios ajustes/fixes puntuales**:
    - Se sacaron las pruebas "Enviar por correo"/"Enviar por WhatsApp" de
      `guardDesk` (funcionalidad configurable pero que no se usa
      actualmente).
    - Se eliminó el módulo standalone "Carnet / QR Cédula" (sus 2 pruebas
      propias) porque no se usaba — **pero esto rompió sin querer** la
      posibilidad de habilitar las pruebas `[Carnet]` integradas en QR/Facial
      para comunidades nuevas, porque esas pruebas dependen de
      `enabledModules.includes('qrcarnet')` y ya no había forma de
      seleccionar ese módulo. Se corrigió reagregando `qrcarnet` como módulo
      opcional seleccionable pero **sin pruebas propias** (`tests: []`), con
      una descripción custom ("no agrega tarjeta propia, solo habilita
      pruebas en QR/Facial"). `buildChecklistByPhases` ahora omite crear
      tarjeta para un módulo con `tests.length === 0`, para no mostrar una
      tarjeta vacía "0 de 0". **Ojo con este patrón** si se agregan más
      módulos "solo-flag" en el futuro.
    - Se excluyó `guardDesk`/`guardPda` de la Ficha Técnica de
      puertas/relés/IP (`getTechnicalDeviceReport`, constante
      `DOOR_RELAY_EXEMPT_TYPES`): estos dispositivos no están atados a una
      puerta ni un relé específico por diseño (abren cualquier puerta, el
      relé varía según cuál), así que aparecer en "sin puerta asignada / sin
      relé configurado" era una falsa alarma.
    - Se sacó `stickertag` de `ACCESS_DEVICES` en `checklist.js`: Anti-Passback
      se configura **por puerta**, así que un StickerTag que compartía puerta
      con un lector Facial/QR con antipassback heredaba esas pruebas sin
      corresponder.

## Decisiones de diseño importantes (el *por qué*, no solo el *qué*)

- **Tres capas de observaciones, cada una con propósito distinto — no
  mezclar**: comentario por prueba puntual (`taskResults[id].comment`) →
  nota por dispositivo completo (`deviceNotes[deviceId]`, para "este equipo
  entero quedó bloqueado/reemplazado") → Observaciones Generales (notas
  transversales, listas para ticket, no ligadas a un dispositivo ni prueba
  específica). Si se pide "agregar un comentario en bloque" o similar, hay
  que preguntar en qué capa corresponde antes de implementar.
- **El estado técnico (APTO/NO APTO/BLOQUEADO/EN PROGRESO) nunca se
  modifica manualmente.** Es siempre derivado puro de los resultados de las
  pruebas (`getFinalLabStatus(summary)`). Decisiones de negocio como
  "se entrega igual aunque no esté Apto" se registran aparte
  (`deliveryException`), nunca sobreescribiendo el estado calculado.
- **"Cerrar proyecto" es un estado único, no un historial.** Se decidió así
  explícitamente (más simple para empezar) — si en algún momento el usuario
  pide poder reabrir y cerrar varias veces sin perder la versión anterior,
  eso es una feature nueva, no algo que ya exista.
- **El Reporte General es local-only, a propósito.** No hay backend, así que
  solo agrega comunidades del navegador actual. Si se pide "que el equipo
  vea el reporte de todos los técnicos", eso requiere una decisión de
  arquitectura mayor (backend o algún mecanismo de fusión de exports), no
  es un cambio chico.
- **Los módulos opcionales pueden no tener pruebas propias**
  (`tests: []`) si su único propósito es habilitar pruebas en otros
  dispositivos (caso `qrcarnet`). `buildChecklistByPhases` ya contempla este
  caso y no genera una tarjeta vacía para ellos.

## Qué adjuntarle a la sesión de IA nueva

1. **Este archivo completo** (`PROJECT_CONTEXT.md`) — es el resumen del
   *por qué*, las decisiones y las trampas conocidas, que no se ven leyendo
   el código solo.
2. **Si la sesión nueva tiene acceso al repo/filesystem** (por ejemplo, otra
   sesión de Claude Code apuntando a esta misma carpeta): con este
   documento alcanza, el código es la fuente de verdad del estado actual —
   que lea directamente `deviceCatalog.jsx`, `checklist.js`, `App.jsx` y
   `report.js` para el detalle exacto.
3. **Si la sesión nueva NO tiene acceso al repo** (chat sin archivos, por
   ejemplo): además de este documento, conviene adjuntar el contenido de
   estos archivos puntuales, que son los que concentran la lógica de
   negocio no obvia:
   - `src/data/deviceCatalog.jsx`
   - `src/utils/checklist.js`
   - `src/utils/report.js`
   - `src/App.jsx`
4. Contale a la IA nueva **qué tarea puntual querés que haga** — este
   documento da el contexto general, pero no reemplaza decirle el pedido
   específico de la sesión (igual que se hizo acá turno a turno).
