# Decisión de arquitectura — Automatización QA Smartki

Estado: propuesta para Scrum/PO. No implica cambios en `qa-labflow-dashboard`
(la SPA) — solo en `automation/`, que ya existe como servicio separado.

## Opciones evaluadas

| # | Opción | Qué implica | Tiempo a 1er valor | Riesgo | Mantenimiento a futuro |
|---|---|---|---|---|---|
| 0 | Seguir 100% manual | No cambia nada | — | Ninguno técnico | Ninguno — pero el costo en horas por instalación nunca baja |
| 1 | Backend propio desde cero | Base de datos propia con topología, credenciales y lógica de pruebas, re-modelando lo que Cooper ya tiene | Alto (semanas) | Alto — datos duplicados, se desincroniza de la config real en cuanto alguien edita algo en Cooper y no acá | Alto — dos fuentes de verdad de la misma topología, para siempre |
| 2 | Meter el backend dentro de QA LabFlow | Agregar un servidor a la SPA actual, revirtiendo su decisión deliberada de "sin backend" | Medio | Alto — toca una herramienta que ya está en uso diario; todo el checklist pasa a depender de que ese servidor nuevo esté sano | Medio-alto — mezcla dos responsabilidades distintas (checklist humano vs. orquestación de pruebas) en un mismo código |
| 3 | **Orquestador liviano sobre Cooper/Smartki (recomendada)** | Servicio Node aparte (`automation/`, ya scaffoldeado), sin base de datos propia: consulta Cooper para la topología real y la API de Smartki para simular eventos | Bajo — ya hay una primera pieza corriendo (chequeo de salud del entorno) | Bajo — no toca QA LabFlow, no duplica datos; el riesgo que sí existe es que Cooper/Smartki cambien de contrato sin aviso | Bajo — una sola fuente de verdad (Cooper); `automation/` es puro consumidor, reemplazable sin perder datos |

## Por qué la opción 3

- **No duplica lo que ya existe.** Cooper ya es la fuente de verdad de qué
  dispositivos tiene cada comunidad, en qué puerta, con qué configuración.
  Construir un backend propio (opción 1) significa mantener esa misma
  información dos veces — y la copia se desactualiza la primera vez que
  alguien edita algo en Cooper y no en el sistema nuevo.
- **No arriesga la herramienta que ya usás todos los días.** QA LabFlow es
  sin backend a propósito (ver `PROJECT_CONTEXT.md`). Meterle un servidor
  (opción 2) para resolver un problema que no es del checklist sino de
  automatización de hardware sería cargarle riesgo a algo que hoy funciona
  bien, sin necesidad.
- **Ya está empezado.** `automation/` (ver su README) tiene un primer
  chequeo real funcionando. No es una propuesta en el aire, es la
  continuación de lo que ya está en la rama.
- **El costo de cambiar de opinión es bajo.** Al no tener base de datos
  propia, si en el futuro se decide otra arquitectura, no hay datos que
  migrar — `automation/` es reemplazable sin pérdida.

## Arquitectura objetivo

```
Cooper (topología real)  ──┐
                            ├──▶  automation/ (orquestador, sin BD propia)  ──▶  Reporte
Smartki API (simular)   ───┘                                                      │
                                                                                    ▼
                                                            (fase futura) import a QA LabFlow
```

`automation/` no sabe de antemano cuántos dispositivos tiene una comunidad:
le pregunta a Cooper, recorre lo que le devuelva (2 controladores o 40, da
igual), y por cada instancia llama al endpoint de simulación
correspondiente a su tipo. Detalle completo con diagramas en el artifact
"RFC Automatización QA" (link compartido aparte) y en `AUTOMATION_ROADMAP.md`.

## Qué falta para pasar de propuesta a ejecución

Una sola pregunta técnica pendiente de desarrollo, ya acotada con
precedente concreto (`ParkBridgeServer`, ver `AUTOMATION_ROADMAP.md`):
confirmar el endpoint de simulación de eventos de acceso para comunidades
(no parking) y el endpoint de listado de dispositivos por comunidad
(probablemente ya existe — es lo que usa el propio Cooper para mostrar su
lista de dispositivos). No es un pedido de feature nueva grande: es
confirmar/exponer contratos que es muy probable que ya existan
internamente.

## Riesgos a declarar ante Scrum/PO

- Dependencia de que Cooper y la API de Smartki no cambien de contrato sin
  aviso — `automation/` no controla eso.
- Si el endpoint de simulación no existe para acceso general (solo para
  Park), desarrollo tendría que construirlo — ese esfuerzo todavía no está
  estimado por nadie del equipo de Smartki.
- La automatización cubre un subconjunto del catálogo de pruebas (ver
  clasificación 🟢/🟡/🔴 en `AUTOMATION_ROADMAP.md`) — reduce el tiempo de
  testeo manual, no lo reemplaza completo.
