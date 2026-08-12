import { DEVICE_CATALOG } from '../data/deviceCatalog.jsx';
import {
  CAMERA_CAPABLE_TYPES,
  CARD_READER_CAPABLE_TYPES,
  getDirectionLabel,
  getRelaysLabel,
  getRelaySourceLabel,
} from '../constants/accessConfig.js';

const GUARD_DEVICES = ['guardDesk', 'guardPda'];
const ACCESS_DEVICES = ['qr', 'stickertag', 'lpr', 'facial', ...GUARD_DEVICES];

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

function buildDynamicTests(selectedCommunity, peripheralType, baseTests, instance) {
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

  if (rules.multivalidation && rules.multiFactors?.includes(peripheralType)) {
    const factorNames = rules.multiFactors
      .map(id => DEVICE_CATALOG[id]?.name)
      .filter(Boolean)
      .join(' + ');

    dynamicTests.push(
      `[Multi Validación] Confirmar factores configurados: ${factorNames}.`,
      '[Multi Validación] Acceso con todos los factores correctos → ingreso concedido.',
      '[Multi Validación] Acceso con solo uno de los factores → acceso denegado.',
      '[Multi Validación] Tiempo de espera entre validaciones respetado.',
      '[Multi Validación] Registro del evento multi-validación en el sistema.'
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
          instance
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
