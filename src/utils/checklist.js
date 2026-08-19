import { DEVICE_CATALOG } from '../data/deviceCatalog.jsx';
import {
  CAMERA_CAPABLE_TYPES,
  CARD_READER_CAPABLE_TYPES,
  SIGNAL_LIGHT_CAPABLE_TYPES,
  getDirectionLabel,
  getRelaysLabel,
  getRelaySourceLabel,
} from '../constants/accessConfig.js';

const GUARD_DEVICES = ['guardDesk', 'guardPda'];
// StickerTag no recibe pruebas de Anti-Passback: aunque comparta puerta con
// un lector que sí antipassbackea, no corresponde agregárselas a él.
const ACCESS_DEVICES = ['qr', 'lpr', 'facial', ...GUARD_DEVICES];

// Dispositivos que pueden participar de una cadena de Multivalidación.
// A diferencia de Anti-Passback/Cancelar Invitación, Guard Desk/PDA no
// forman parte de esta cadena.
const MULTIVALIDATION_DEVICES = ['lpr', 'qr', 'facial'];

// Pruebas propias del pipeline de validación de cada factor dentro de una
// cadena de Multivalidación (independiente de si la cadena es doble o
// triple, y de qué otros factores la acompañen).
const MULTIVALIDATION_FACTOR_TESTS = {
  lpr: [
    'LPR: patente detectada coincide con vehículo registrado → habilita el resto de la cadena.',
    'LPR: patente en lista negra → acceso denegado sin evaluar el resto de los factores.',
    'LPR: lectura de baja confianza (patente parcial/borrosa) → no habilita el resto de la cadena.',
  ],
  qr: [
    'QR: código fuera de vigencia (vencido) → acceso denegado aunque el resto de factores sean correctos.',
    'QR: usuario sin vigencia activa → acceso denegado.',
    'QR: misma lectura repetida dentro de la ventana anti-duplicado configurada → no genera un segundo evento.',
  ],
  facial: [
    'Facial: rostro reconocido pero usuario sin permiso/horario habilitado → acceso denegado.',
    'Facial: rostro no reconocido → no habilita el resto de la cadena.',
  ],
};

function getMultivalidationFactorTests(factorKey, { integrated = false } = {}) {
  const baseTests = MULTIVALIDATION_FACTOR_TESTS[factorKey] || [];
  // Cuando el QR es el lector integrado de Facial (mismo equipo, sin un
  // Lector QR físico aparte), se reusa el mismo pipeline de validación de
  // QR pero fraseado como "QR integrado" en vez de "QR".
  return integrated
    ? baseTests.map(test => test.replace(/^QR:/, 'QR integrado:'))
    : baseTests;
}

// La Multivalidación ya no es una regla global de la comunidad: se detecta
// automáticamente por puerta, según qué dispositivos (LPR/Facial/QR) están
// conectados a esa misma puerta. Esto permite que una sola comunidad tenga
// zonas con doble validación (ej. Facial con su QR integrado en un
// torniquete) y zonas con triple validación (ej. LPR + Facial + QR en un
// pilar vehicular) sin pisarse entre sí.
//
// La Cámara Facial siempre trae su propio lector QR integrado (ver sus
// pruebas base), así que aporta el factor Facial Y el factor QR por sí sola,
// sin necesitar un Lector QR físico aparte.
function computeDoorFactors(node) {
  const doorFactors = {};

  (node.peripherals || []).forEach(peripheralConfig => {
    if (!MULTIVALIDATION_DEVICES.includes(peripheralConfig.type)) return;

    const qty = Number(peripheralConfig.qty) || 1;
    for (let index = 0; index < qty; index += 1) {
      const instance = getPeripheralInstance(peripheralConfig, index);
      if (!instance.doorId) continue;

      if (!doorFactors[instance.doorId]) {
        doorFactors[instance.doorId] = { hasLpr: false, hasFacial: false, hasStandaloneQr: false };
      }
      if (peripheralConfig.type === 'lpr') doorFactors[instance.doorId].hasLpr = true;
      if (peripheralConfig.type === 'facial') doorFactors[instance.doorId].hasFacial = true;
      if (peripheralConfig.type === 'qr') doorFactors[instance.doorId].hasStandaloneQr = true;
    }
  });

  return doorFactors;
}

function getDoorFactorSummary(factors) {
  const parts = [];
  if (factors.hasLpr) parts.push(DEVICE_CATALOG.lpr?.name || 'LPR');

  if (factors.hasFacial) {
    const facialName = DEVICE_CATALOG.facial?.name || 'Facial';
    parts.push(
      factors.hasStandaloneQr
        ? `${facialName} (con QR integrado) + ${DEVICE_CATALOG.qr?.name || 'QR'}`
        : `${facialName} (con QR integrado)`
    );
  } else if (factors.hasStandaloneQr) {
    parts.push(DEVICE_CATALOG.qr?.name || 'QR');
  }

  return parts.join(' + ');
}

function createTaskId(communityId, baseId, testIndex) {
  return `community-${communityId}-${baseId}-test-${testIndex}`;
}

function initPhase(phases, phaseNumber, phaseName) {
  if (!phases[phaseNumber]) {
    phases[phaseNumber] = {
      phaseNumber,
      phaseName,
      devices: [],
    };
  }
}

function buildDynamicTests(selectedCommunity, peripheralType, baseTests, instance, doorFactors) {
  const dynamicTests = [...baseTests];
  const rules = selectedCommunity?.rules || {};
  const enabledModules = Array.isArray(selectedCommunity?.modules) ? selectedCommunity.modules : [];

  const antipassbackDoorIds = Array.isArray(rules.antipassbackDoorIds) ? rules.antipassbackDoorIds : [];
  const doorHasAntipassback = rules.antipassback &&
    instance?.doorId &&
    antipassbackDoorIds.includes(instance.doorId);

  if (doorHasAntipassback && ACCESS_DEVICES.includes(peripheralType)) {
    const direction = instance?.direction || '';
    const handlesEntry = direction !== 'salida';

    if (handlesEntry) {
      dynamicTests.push(
        '[Anti-Passback] Intento de doble entrada sin salida previa → acceso denegado.',
        '[Anti-Passback] Flujo correcto entrada → salida → entrada funciona sin problemas.'
      );
    } else {
      dynamicTests.push(
        '[Anti-Passback] Verificar que la salida siempre es permitida (Anti-Passback no debe bloquear el egreso).'
      );
    }
    dynamicTests.push(
      '[Anti-Passback] Registro de evento Anti-Passback visible en logs/eventos.'
    );
  }

  const cancelInvitationDoorIds = Array.isArray(rules.cancelInvitationDoorIds) ? rules.cancelInvitationDoorIds : [];
  const doorHasCancelInvitation = rules.cancelInvitation &&
    instance?.doorId &&
    cancelInvitationDoorIds.includes(instance.doorId);
  const isTemporaryCredentialDevice = GUARD_DEVICES.includes(peripheralType) ||
    (['qr', 'facial'].includes(peripheralType) && (enabledModules.includes('invitaciones') || enabledModules.includes('qrcarnet')));

  if (doorHasCancelInvitation && isTemporaryCredentialDevice) {
    const direction = instance?.direction || '';
    const handlesEntry = direction !== 'salida';

    if (handlesEntry) {
      dynamicTests.push(
        '[Cancelar Invitación] Ingreso con visita/invitación/carnet válido → acceso concedido y la credencial queda invalidada para un nuevo ingreso.',
        '[Cancelar Invitación] Reintento de ingreso con la misma visita/invitación/carnet ya utilizada → acceso denegado.'
      );
    } else {
      dynamicTests.push(
        '[Cancelar Invitación] Verificar que la salida siempre es permitida (Cancelar Invitación no debe bloquear el egreso).'
      );
    }
    dynamicTests.push(
      '[Cancelar Invitación] Registro del evento de cancelación de la credencial visible en logs/eventos.'
    );
  }

  if (instance?.cameraEnabled && CAMERA_CAPABLE_TYPES.includes(peripheralType)) {
    const camRef = instance.cameraIp ? ` (${instance.cameraIp})` : '';
    dynamicTests.push(
      `[Cámara IP${camRef}] Verificar que la cámara captura imagen al accionar el dispositivo.`,
      `[Cámara IP${camRef}] Verificar que la imagen queda registrada y visible en el sistema.`
    );
  }

  if (instance?.cardReaderEnabled && CARD_READER_CAPABLE_TYPES.includes(peripheralType)) {
    dynamicTests.push(
      '[Lector de Carnet] Deslizar el carnet en el lector externo autocompleta correctamente los datos de la visita.',
      '[Lector de Carnet] Carnet no reconocido o dañado → el sistema permite completar los datos manualmente sin bloquear el registro.'
    );
  }

  if (peripheralType === 'qr' || peripheralType === 'facial') {
    if (enabledModules.includes('qrcarnet')) {
      dynamicTests.push(
        '[Carnet] Carnet reconocido correctamente por este lector.',
        '[Carnet] QR de usuario no registrado o eliminado → acceso denegado en este lector.',
        '[Carnet] QR carnet de usuario registrado → acceso concedido en este lector.',
        '[Carnet] Registro del evento de acceso por carnet visible en el sistema.'
      );
    }

    if (enabledModules.includes('invitaciones')) {
      dynamicTests.push(
        '[Invitaciones] Invitación válida presentada en este lector → acceso concedido.',
        '[Invitaciones] Invitación fuera de fecha/hora presentada en este lector → acceso denegado.',
        '[Invitaciones] Registro del evento de acceso por invitación visible en el sistema.'
      );
    }
  }

  if (instance?.signalLightEnabled && SIGNAL_LIGHT_CAPABLE_TYPES.includes(peripheralType)) {
    const relayRef = instance.signalLightRelay ? ` (${instance.signalLightRelay})` : '';
    const secondsRef = instance.signalLightSeconds ? ` durante ${instance.signalLightSeconds}` : '';
    dynamicTests.push(
      `[Señalización${relayRef}] Verificar que la luz/señalizador se enciende al conceder el acceso.`,
      `[Señalización${relayRef}] Verificar que la luz se apaga sola tras el tiempo configurado${secondsRef}.`
    );
  }

  // Multivalidación: se agrega al final (no entre las capas anteriores) para
  // no correr de posición los IDs de pruebas ya guardadas de instalaciones
  // existentes que nunca la usan (ver PROJECT_CONTEXT.md sobre IDs
  // posicionales). Se detecta automáticamente por puerta — ver
  // computeDoorFactors más arriba — en vez de una regla global.
  const doorFactorsForThisDoor = instance?.doorId ? doorFactors?.[instance.doorId] : null;

  if (doorFactorsForThisDoor && MULTIVALIDATION_DEVICES.includes(peripheralType)) {
    const { hasLpr, hasFacial, hasStandaloneQr } = doorFactorsForThisDoor;
    const hasQr = hasFacial || hasStandaloneQr; // el QR integrado de Facial cuenta como factor QR
    const factorCount = [hasLpr, hasFacial, hasQr].filter(Boolean).length;
    const isMultivalidation = factorCount >= 2;

    if (isMultivalidation) {
      const factorNames = getDoorFactorSummary(doorFactorsForThisDoor);

      // Capa 1: pruebas comunes a cualquier cadena de Multivalidación (doble
      // o triple, cualquier combinación de factores presentes en esta puerta).
      dynamicTests.push(
        `[Multi Validación] Confirmar factores configurados en esta puerta: ${factorNames}.`,
        '[Multi Validación] Acceso con todos los factores correctos → ingreso concedido.',
        '[Multi Validación] Acceso con uno o más factores incorrectos/faltantes → acceso denegado.',
        '[Multi Validación] Validación completa dentro del tiempo máximo configurado → ingreso concedido sin demoras anómalas.',
        '[Multi Validación] Espera prolongada sin completar todos los factores (fuera del tiempo máximo configurado) → el sistema degrada a un flujo alternativo sin quedar trabado.',
        '[Multi Validación] Registro del evento consolidado (todos los factores bajo el mismo evento) visible en el sistema.'
      );

      // Capa 2: pruebas propias del pipeline de validación de este equipo
      // dentro de la cadena (LPR/QR/Facial validan cosas distintas).
      getMultivalidationFactorTests(peripheralType)
        .forEach(test => dynamicTests.push(`[Multi Validación] ${test}`));

      // Facial siempre aporta también su propio pipeline de QR integrado,
      // sin importar si además hay un Lector QR físico en la misma puerta.
      if (peripheralType === 'facial') {
        getMultivalidationFactorTests('qr', { integrated: true })
          .forEach(test => dynamicTests.push(`[Multi Validación] ${test}`));
      }

      // Capa 3: cadena con LPR + Facial (triple, con QR propio o integrado).
      // Lo único garantizado por diseño es que LPR se valida primero
      // (identifica el vehículo antes de pedir el resto); el orden entre
      // Facial y QR no está fijo.
      if (hasLpr && hasFacial) {
        dynamicTests.push(
          '[Multi Validación] LPR se valida primero en la cadena: si no coincide o no habilita el paso, el acceso se deniega sin llegar a solicitar Facial ni QR.'
        );
      }
    }
  }

  return dynamicTests;
}

function getPeripheralInstance(peripheralConfig, index) {
  const existingInstance = Array.isArray(peripheralConfig.instances)
    ? peripheralConfig.instances[index]
    : null;

  return {
    id: String(existingInstance?.id ?? index),
    label: existingInstance?.label || '',
    doorId: existingInstance?.doorId || '',
    direction: existingInstance?.direction || '',
    port: existingInstance?.port || '',
    portNote: existingInstance?.portNote || '',
    ip: existingInstance?.ip || '',
    relaySource: existingInstance?.relaySource || 'controller',
    relays: Array.isArray(existingInstance?.relays)
      ? existingInstance.relays
      : (existingInstance?.relay ? [existingInstance.relay] : []),
    relayNote: existingInstance?.relayNote || '',
    actionSeconds: existingInstance?.actionSeconds || '',
    cameraEnabled: existingInstance?.cameraEnabled ?? false,
    cameraIp: existingInstance?.cameraIp || '',
    cardReaderEnabled: existingInstance?.cardReaderEnabled ?? false,
    signalLightEnabled: existingInstance?.signalLightEnabled ?? false,
    signalLightRelay: existingInstance?.signalLightRelay || '',
    signalLightSeconds: existingInstance?.signalLightSeconds || '',
  };
}

function getPeripheralDisplayName(peripheralCatalog, peripheralConfig, index, qty) {
  const instance = getPeripheralInstance(peripheralConfig, index);
  const customLabel = instance.label?.trim();
  const defaultName = `${peripheralCatalog.name}${qty > 1 ? ` #${index + 1}` : ''}`;

  return customLabel ? `${peripheralCatalog.name} - ${customLabel}` : defaultName;
}

function getDoorInfo(node, instance) {
  if (!instance.doorId) return null;

  const door = (node.doors || []).find(candidate => candidate.id === instance.doorId);
  if (!door) return null;

  return {
    name: door.name || 'Puerta sin nombre',
    zone: door.zone || '',
    type: door.type || '',
    direction: instance.direction,
    directionLabel: getDirectionLabel(instance.direction),
  };
}

function getRelayInfo(instance) {
  const isDeviceRelay = instance.relaySource === 'device';
  const relays = Array.isArray(instance.relays) ? instance.relays : (instance.relay ? [instance.relay] : []);
  const hasData = isDeviceRelay || relays.length > 0 || instance.actionSeconds;
  if (!hasData) return null;

  const relayLabel = isDeviceRelay
    ? 'Relé integrado del dispositivo'
    : getRelaysLabel(relays, instance.relayNote);

  return {
    source: instance.relaySource,
    sourceLabel: getRelaySourceLabel(instance.relaySource),
    relays,
    relayLabel,
    actionSeconds: instance.actionSeconds,
  };
}

function applyDoorContextToDescription(description, doorInfo, relayInfo) {
  if (!description.includes('relé correspondiente')) return description;
  if (!doorInfo && !relayInfo) return description;

  const parts = [];
  if (doorInfo) parts.push(`Puerta: ${doorInfo.name}`);
  if (relayInfo?.relayLabel) parts.push(`Relé: ${relayInfo.relayLabel}`);
  if (relayInfo?.actionSeconds) parts.push(`${relayInfo.actionSeconds}s`);

  if (parts.length === 0) return description;
  return `${description} (${parts.join(', ')})`;
}

function getEnabledModuleIds(selectedCommunity) {
  if (Array.isArray(selectedCommunity?.modules)) {
    return selectedCommunity.modules;
  }

  if (Array.isArray(selectedCommunity?.enabledModules)) {
    return selectedCommunity.enabledModules;
  }

  return [];
}

export function buildChecklistByPhases(selectedCommunity) {
  if (!selectedCommunity?.nodes?.length) return [];

  const phases = {};

  selectedCommunity.nodes.forEach(node => {
    const hubCatalog = DEVICE_CATALOG[node.type];
    if (!hubCatalog) return;

    initPhase(phases, hubCatalog.phase, hubCatalog.phaseName);

    phases[hubCatalog.phase].devices.push({
      id: `community-${selectedCommunity.id}-${node.id}`,
      deviceName: `${hubCatalog.name} (${node.label})`,
      type: hubCatalog.id,
      typeName: hubCatalog.name,
      icon: hubCatalog.icon,
      tasks: hubCatalog.tests.map((description, testIndex) => ({
        id: createTaskId(selectedCommunity.id, `${node.id}-controller`, testIndex),
        description,
      })),
    });

    const doorFactors = computeDoorFactors(node);

    (node.peripherals || []).forEach(peripheralConfig => {
      const peripheralCatalog = DEVICE_CATALOG[peripheralConfig.type];
      if (!peripheralCatalog) return;

      initPhase(phases, peripheralCatalog.phase, peripheralCatalog.phaseName);

      const qty = Number(peripheralConfig.qty) || 1;

      for (let index = 0; index < qty; index += 1) {
        const instance = getPeripheralInstance(peripheralConfig, index);
        const dynamicTests = buildDynamicTests(
          selectedCommunity,
          peripheralConfig.type,
          peripheralCatalog.tests,
          instance,
          doorFactors
        );
        const baseId = `${node.id}-${peripheralConfig.type}-${instance.id}`;
        const deviceDisplayName = getPeripheralDisplayName(
          peripheralCatalog,
          peripheralConfig,
          index,
          qty
        );
        const doorInfo = getDoorInfo(node, instance);
        const relayInfo = getRelayInfo(instance);

        phases[peripheralCatalog.phase].devices.push({
          id: `community-${selectedCommunity.id}-${baseId}`,
          deviceName: `${deviceDisplayName} [Conectado a: ${node.label}]`,
          type: peripheralCatalog.id,
          typeName: peripheralCatalog.name,
          icon: peripheralCatalog.icon,
          doorInfo,
          relayInfo,
          port: instance.port,
          ip: instance.ip,
          cameraEnabled: instance.cameraEnabled,
          cameraIp: instance.cameraIp,
          cardReaderEnabled: instance.cardReaderEnabled,
          signalLightEnabled: instance.signalLightEnabled,
          signalLightRelay: instance.signalLightRelay,
          tasks: dynamicTests.map((description, testIndex) => ({
            id: createTaskId(selectedCommunity.id, baseId, testIndex),
            description: applyDoorContextToDescription(description, doorInfo, relayInfo),
          })),
        });
      }
    });
  });

  const enabledModuleIds = getEnabledModuleIds(selectedCommunity);

  enabledModuleIds.forEach(moduleId => {
    const moduleConfig = DEVICE_CATALOG[moduleId];
    if (!moduleConfig || moduleConfig.role !== 'optionalModule') return;
    // Un módulo sin pruebas propias (ej. qrcarnet, que solo habilita pruebas
    // en otros dispositivos) no genera su propia tarjeta vacía en el checklist.
    if (moduleConfig.tests.length === 0) return;

    initPhase(phases, moduleConfig.phase, moduleConfig.phaseName);

    phases[moduleConfig.phase].devices.push({
      id: `community-${selectedCommunity.id}-module-${moduleConfig.id}`,
      deviceName: `${moduleConfig.name} (Módulo habilitado)`,
      type: moduleConfig.id,
      typeName: moduleConfig.name,
      icon: moduleConfig.icon,
      tasks: moduleConfig.tests.map((description, testIndex) => ({
        id: createTaskId(selectedCommunity.id, `module-${moduleConfig.id}`, testIndex),
        description,
      })),
    });
  });

  return Object.values(phases).sort((a, b) => a.phaseNumber - b.phaseNumber);
}

// Los devices generados en memoria llevan `icon` como elemento React (JSX),
// que no es serializable a JSON/localStorage. Al cerrar un proyecto se
// guarda una foto del checklist sin el icono, y se reconstruye al leerla
// usando el catálogo actual (el icono es solo cosmético, no afecta qué se probó).
export function stripIconsForSnapshot(checklistByPhases) {
  return checklistByPhases.map(phase => ({
    ...phase,
    devices: phase.devices.map(({ icon, ...device }) => ({ ...device })),
  }));
}

export function hydrateSnapshotIcons(checklistByPhases) {
  return (checklistByPhases || []).map(phase => ({
    ...phase,
    devices: phase.devices.map(device => ({
      ...device,
      icon: DEVICE_CATALOG[device.type]?.icon || null,
    })),
  }));
}
