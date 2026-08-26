# QA LabFlow — Automation (servicio separado)

Este directorio es un **servicio Node aparte**, no parte de la SPA de
`qa-labflow-dashboard`. Existe porque cualquier automatización real contra
hardware/API de Smartki necesita credenciales de servidor (no pueden vivir
en el navegador), y la SPA sigue siendo deliberadamente sin backend — ver
`PROJECT_CONTEXT.md` en la raíz del repo.

Los resultados de acá **no se sincronizan automáticamente** con la SPA
todavía. Por ahora quedan como reportes JSON en `automation/reports/`
(gitignored). Integrarlos al checklist (por ejemplo, pre-completar el
resultado de una prueba puntual) es un paso futuro, no construido aún.

## Qué hace hoy

Un solo chequeo real: **salud del entorno de Certificación** —
confirma que la API de Smartki, la API de Activity, el dashboard y Cooper
responden antes de salir a terreno con la checklist manual. Corresponde a
las pruebas de catálogo "Conexión a red LAN/WiFi activa y estable" /
"Servicios Smartki activos después de reinicio controlado" del dispositivo
`controller`, del lado cloud (no reemplaza verificar el controlador físico
en sitio).

```bash
cd automation
npm install
cp .env.example .env   # completar con las URLs/credenciales reales de Cert
npm run check:env
```

## Por qué no hay más automatizado todavía

Para automatizar pruebas reales (lectura QR válida → acceso concedido,
apertura de relé, detección de StickerTag, etc.) hace falta que alguien del
equipo de desarrollo de Smartki confirme, por dispositivo:

1. **Flujo de auth de la API 2.0** (usuario/clave → JWT, API key fija, u
   otro) — no está confirmado, por eso `SMARTKI_API_USER`/`_PASSWORD` en
   `.env.example` están sin usar todavía.
2. **Endpoint(s) para consultar estado de un dispositivo/controlador**
   (online/offline, último keep-alive) — existe la idea (ver Jira
   SL-2044/BBL-647/BBL-634, "Monitor de comunidades") pero no encontré la
   spec de endpoint publicada.
3. **Endpoint(s) para simular/forzar un evento de acceso** (QR válido,
   lectura de tag, patente LPR) y leer el resultado (concedido/denegado,
   relé activado) — necesario para automatizar los casos "válido → acceso
   concedido" / "inválido → acceso denegado" de cada periférico.

Sin esos tres puntos confirmados, escribir código que llame a paths
adivinados generaría falsos verdes o falsos rojos — peor que no automatizar
nada. Ver `../AUTOMATION_ROADMAP.md` en la raíz para el detalle
prueba-por-prueba de qué se puede automatizar ya, qué depende de esto, y
qué nunca se va a poder automatizar (requiere presencia física).
