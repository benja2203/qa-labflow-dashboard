# QA LabFlow Dashboard

Dashboard React/Vite para generar checklists QA de validación de dispositivos Smartki antes de instalación.

## Funciones principales

- Crear, editar y eliminar comunidades.
- Agregar controladores y periféricos.
- Nombrar cada equipo físico por ubicación/acceso.
- Seleccionar módulos opcionales: App - Invitaciones y Carnet / QR Cédula.
- Activar reglas avanzadas como Anti-Passback y Multivalidación.
- Registrar estado por prueba: Pending, Pass, Fail, Blocked y N/A.
- Agregar observación y evidencia por prueba.
- Exportar JSON.
- Descargar PDF compacto recomendado o PDF completo con todas las pruebas.

## Instalación

```bash
npm install --registry=https://registry.npmjs.org/
npm run dev
```

## Nota sobre reportes PDF

El PDF compacto es el recomendado para adjuntar como evidencia general, porque no lista todas las pruebas una por una. Incluye resumen, cobertura por equipo, observaciones/fallas/evidencias y topología.

El PDF completo incluye el detalle completo de cada prueba ejecutada y puede ser largo si hay muchos dispositivos.
