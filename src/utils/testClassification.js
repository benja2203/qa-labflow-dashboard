import { DEVICE_CATALOG } from '../data/deviceCatalog.jsx';
import { getTaskResult } from './report.js';

// Clasificación de pruebas para la tabla "Detalle de pruebas con falla o
// bloqueo" del reporte. Se calcula a partir del TEXTO de la prueba (no se
// guarda en el catálogo) para que funcione igual con proyectos cerrados,
// JSON importados y pruebas dinámicas ([Anti-Passback], [Carnet], etc.).
//
// La idea es que "Tipo de prueba" e "Impacto" sean valores FIJOS (no texto
// libre del técnico): así se pueden agrupar en Excel/Looker para ver qué
// tipo de prueba es la que más falla entre proyectos.

export const TEST_CATEGORIES = {
  connectivity: { label: 'Encendido / Conectividad', impact: 'Equipo inoperativo o sin comunicación' },
  configuration: { label: 'Configuración', impact: 'Configuración incorrecta del equipo o servicio' },
  reading: { label: 'Lectura / Reconocimiento', impact: 'El lector no reconoce la credencial' },
  accessGranted: { label: 'Acceso concedido', impact: 'Usuarios autorizados no pueden ingresar' },
  accessDenied: { label: 'Acceso denegado', impact: 'Riesgo de seguridad: podría ingresar alguien no autorizado' },
  relay: { label: 'Apertura de relé', impact: 'Valida el acceso pero no abre la puerta/barrera' },
  eventLog: { label: 'Registro de eventos', impact: 'Pérdida de trazabilidad: el acceso no queda registrado' },
  feedback: { label: 'Feedback al usuario', impact: 'El usuario no recibe señal clara del resultado' },
  edgeCase: { label: 'Caso de borde', impact: 'Falla en condiciones reales de uso' },
  imageCapture: { label: 'Captura de imagen', impact: 'Sin evidencia visual del acceso' },
  operation: { label: 'Funcionalidad / Operación', impact: 'La operación desde la interfaz no funciona como se espera' },
  accessRule: { label: 'Regla de acceso', impact: 'La regla de acceso configurada no se cumple' },
};

// Pruebas cuyo texto engaña al clasificador por palabras clave. Se comparan
// por inicio de texto porque a las de relé se les agrega "(Puerta: ..., Relé: ...)".
const CATEGORY_OVERRIDES = [
  ['Equipo encendido, pantalla operativa', 'connectivity'],
  ['Formulario de registro de visita', 'operation'],
  ['Al confirmar la visita, se abre el modal', 'operation'],
  ['Apertura remota de una puerta seleccionada desde el desplegable', 'accessGranted'],
  ['Selección de la puerta específica a abrir', 'accessGranted'],
  ['Opción "Registro sin apertura"', 'operation'],
  ['Opción de rellenado manual', 'operation'],
  ['Registro de visitas y aperturas remotas queda visible', 'eventLog'],
  ['Visita puede ingresar de forma autónoma usando el QR propio del carnet', 'accessGranted'],
  ['Eliminar tag, volver agregarlo', 'accessGranted'],
  ['Tag detectado correctamente', 'reading'],
  ['Escaneo del carnet', 'reading'],
  ['Probar tipos de invitación configurados', 'configuration'],
  ['Generación de invitación desde app', 'operation'],
  ['Control remoto disponible en la aplicación', 'operation'],
  ['Panel de actividad en tiempo real', 'operation'],
  ['Verificar que el monitor es solo de visualización', 'operation'],
  ['Periféricos configurados correctamente desde el dashboard', 'configuration'],
  ['Deslizar el carnet en el lector externo', 'reading'],
  ['Carnet no reconocido o dañado', 'operation'],
];

const RULE_TAGS = {
  'Anti-Passback': 'Regla Anti-Passback',
  'Cancelar Invitación': 'Regla Cancelar Invitación',
  'Multi Validación': 'Regla Multivalidación',
};

const MODULE_TAGS = {
  Carnet: 'Carnet / QR Cédula',
  Invitaciones: 'App - Invitaciones',
};

const DEVICE_METHODS = {
  controller: 'Controlador',
  qr: 'Acceso QR',
  stickertag: 'Acceso por Tag',
  lpr: 'Acceso vehicular (LPR)',
  facial: 'Acceso facial',
  hardbutton: 'Apertura manual (botón)',
  guardDesk: 'Guardia',
  guardPda: 'Guardia',
  remoto: 'App - Control remoto',
  invitaciones: 'App - Invitaciones',
  monitor: 'Monitor',
};

function splitTag(description) {
  const match = /^\[([^\]]+)\]\s*(.*)$/.exec(description || '');
  if (!match) return { tag: null, text: description || '' };
  // "[Cámara IP (192.168.1.10)]" / "[Señalización (Relé 2)]" -> nombre sin el detalle
  return { tag: match[1].replace(/\s*\(.*\)$/, ''), text: match[2] };
}

function classifyByKeywords(text) {
  const override = CATEGORY_OVERRIDES.find(([prefix]) => text.startsWith(prefix));
  if (override) return override[1];

  const t = text.toLowerCase();
  if (/relé/.test(t)) return 'relay';
  if (/caso de borde|iluminación|accesorio|brillo/.test(t)) return 'edgeCase';
  if (/encendid|conectad|conexión a red|led de estado/.test(t)) return 'connectivity';
  if (/hora y zona horaria|servicios smartki|reinicio/.test(t)) return 'configuration';
  if (/feedback|sonido|parpadeo|señal visual/.test(t)) return 'feedback';

  // "Patente registrada → barrera abre": lo que se valida es el resultado
  // después de la flecha, no la palabra "registrada" de la condición.
  const outcome = t.includes('→') ? t.slice(t.indexOf('→')) : '';
  if (/denegad|bloquead/.test(outcome)) return 'accessDenied';
  if (/concedid|abre|apertura|se ejecuta/.test(outcome)) return 'accessGranted';

  if (/denegad|bloquead|no genera un segundo evento/.test(t)) return 'accessDenied';
  if (/registr|evento|logs/.test(t)) return 'eventLog';
  if (/reconoc|detectad/.test(t)) return 'reading';
  if (/concedid|apertura|abre|funciona(n)? correctamente|se ejecuta|sin errores/.test(t)) return 'accessGranted';
  return 'operation';
}

export function classifyTest(description, deviceType) {
  const { tag, text } = splitTag(description);

  if (tag && RULE_TAGS[tag]) {
    return { categoryKey: 'accessRule', module: RULE_TAGS[tag] };
  }
  if (tag === 'Cámara IP') return { categoryKey: 'imageCapture', module: DEVICE_METHODS[deviceType] || '' };
  if (tag === 'Señalización') return { categoryKey: 'feedback', module: DEVICE_METHODS[deviceType] || '' };

  const categoryKey = classifyByKeywords(text);

  if (tag && MODULE_TAGS[tag]) return { categoryKey, module: MODULE_TAGS[tag] };

  // La Cámara Facial trae un lector QR integrado: sus pruebas de QR son del
  // método QR, no del reconocimiento facial.
  if (deviceType === 'facial' && /\bQR\b/.test(text)) {
    return { categoryKey, module: 'Acceso QR (integrado en Facial)' };
  }

  return { categoryKey, module: DEVICE_METHODS[deviceType] || DEVICE_CATALOG[deviceType]?.name || '' };
}

// Busca el controlador de un dispositivo. Los checklists nuevos traen
// `nodeId`; los de proyectos cerrados antes de este cambio no, así que se
// cae a reconocerlo por el prefijo del id del dispositivo.
function findDeviceNode(community, device) {
  const nodes = community?.nodes || [];
  if (device.nodeId) return nodes.find(node => node.id === device.nodeId) || null;

  const prefix = `community-${community?.id}-`;
  return nodes.find(node => (
    device.id === `${prefix}${node.id}` || device.id?.startsWith(`${prefix}${node.id}-`)
  )) || null;
}

function countPeripherals(node) {
  return (node.peripherals || []).reduce((sum, peripheral) => sum + (Number(peripheral.qty) || 0), 0);
}

function getDoorRuleNames(community, doorId) {
  const rules = community?.rules || {};
  const names = [];
  if (rules.antipassback && rules.antipassbackDoorIds?.includes(doorId)) names.push('Regla Anti-Passback');
  if (rules.multivalidation && rules.multivalidationDoorIds?.includes(doorId)) names.push('Regla Multivalidación');
  if (rules.cancelInvitation && rules.cancelInvitationDoorIds?.includes(doorId)) names.push('Regla Cancelar Invitación');
  return names;
}

// Módulos opcionales que dependen de los lectores QR/Facial.
const READER_DEPENDENT_MODULES = {
  invitaciones: MODULE_TAGS.Invitaciones,
  qrcarnet: MODULE_TAGS.Carnet,
};

// "También afecta": qué más depende de este equipo según la topología cargada.
export function getDeviceDependencies(community, device) {
  const modules = Array.isArray(community?.modules) ? community.modules : [];
  const node = findDeviceNode(community, device);

  if (device.type === 'controller') {
    if (!node) return 'Todos los accesos de este controlador';
    const doorCount = (node.doors || []).length;
    const peripheralCount = countPeripherals(node);
    return `Todo lo conectado a este controlador: ${doorCount} ${doorCount === 1 ? 'puerta' : 'puertas'}, ${peripheralCount} ${peripheralCount === 1 ? 'periférico' : 'periféricos'} (Fase 2 y Fase 3)`;
  }

  if (device.type === 'remoto') return 'Apertura remota desde la app del residente/administrador';
  if (device.type === 'invitaciones') return 'Ingreso de visitas con invitación en lectores QR/Facial';
  if (device.type === 'monitor') return 'Visualización de accesos en tiempo real';
  if (device.type === 'guardDesk' || device.type === 'guardPda') {
    return 'Registro de visitas y apertura de puertas desde conserjería';
  }

  const parts = [];
  const door = device.doorId ? (node?.doors || []).find(candidate => candidate.id === device.doorId) : null;
  parts.push(door ? `Puerta ${door.name || 'sin nombre'}` : (device.doorInfo?.name ? `Puerta ${device.doorInfo.name}` : 'Sin puerta asignada'));

  if (device.type === 'qr' || device.type === 'facial') {
    modules
      .filter(moduleId => READER_DEPENDENT_MODULES[moduleId])
      .forEach(moduleId => parts.push(READER_DEPENDENT_MODULES[moduleId]));
  }

  if (device.doorId) parts.push(...getDoorRuleNames(community, device.doorId));

  return parts.join(' · ');
}

// Equipo sin el "[Conectado a: ...]" largo, pero conservando de qué
// controlador cuelga (sirve para ubicarlo en terreno).
function getShortDeviceName(deviceName) {
  return String(deviceName || '').replace(/\s*\[Conectado a: (.*)\]$/, ' · $1');
}

export const FAILURE_TABLE_STATUSES = ['fail', 'blocked'];

export function getFailureTableRows(checklistByPhases, taskResults, community) {
  return checklistByPhases.flatMap(phase => (
    phase.devices.flatMap(device => {
      const affects = getDeviceDependencies(community, device);

      return device.tasks
        .map(task => ({ task, result: getTaskResult(taskResults, task.id) }))
        .filter(({ result }) => FAILURE_TABLE_STATUSES.includes(result.status))
        .map(({ task, result }) => {
          const { categoryKey, module } = classifyTest(task.description, device.type);
          const category = TEST_CATEGORIES[categoryKey];

          return {
            id: task.id,
            phaseNumber: phase.phaseNumber,
            phaseLabel: `Fase ${phase.phaseNumber}`,
            phaseName: phase.phaseName,
            module,
            device: getShortDeviceName(device.deviceName),
            test: task.description,
            category: category.label,
            status: result.status,
            impact: category.impact,
            affects,
          };
        });
    })
  ));
}
