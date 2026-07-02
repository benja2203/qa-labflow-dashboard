import { DEVICE_CATALOG } from '../data/deviceCatalog.jsx';
import { getDirectionLabel, getRelayLabel, getRelaySourceLabel } from '../constants/accessConfig.js';

const ACCESS_DEVICES = ['qr', 'stickertag', 'lpr', 'facial'];

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

function buildDynamicTests(selectedCommunity, peripheralType, baseTests) {
  const dynamicTests = [...baseTests];
  const rules = selectedCommunity?.rules || {};

  if (rules.antipassback && ACCESS_DEVICES.includes(peripheralType)) {
    dynamicTests.push(
      '[Anti-Passback] Intento de doble entrada sin salida previa → acceso denegado.',
      '[Anti-Passback] Intento de doble salida sin entrada previa → acceso denegado.',
      '[Anti-Passback] Flujo correcto entrada → salida → entrada funciona sin problemas.',
      '[Anti-Passback] Registro de violación de Anti-Passback visible en logs/eventos.'
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
    relay: existingInstance?.relay || '',
    relayNote: existingInstance?.relayNote || '',
    relayPin: existingInstance?.relayPin || '',
    actionSeconds: existingInstance?.actionSeconds || '',
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
  const hasData = isDeviceRelay || instance.relay || instance.actionSeconds;
  if (!hasData) return null;

  const relayLabel = isDeviceRelay
    ? 'Relé integrado del dispositivo'
    : instance.relay === 'OTRO'
      ? (instance.relayNote || 'Relé externo')
      : instance.relay
        ? getRelayLabel(instance.relay)
        : '';

  return {
    source: instance.relaySource,
    sourceLabel: getRelaySourceLabel(instance.relaySource),
    relay: instance.relay,
    relayLabel,
    relayPin: instance.relayPin,
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
        const dynamicTests = buildDynamicTests(
          selectedCommunity,
          peripheralConfig.type,
          peripheralCatalog.tests
        );

        const instance = getPeripheralInstance(peripheralConfig, index);
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
          icon: peripheralCatalog.icon,
          doorInfo,
          relayInfo,
          port: instance.port,
          ip: instance.ip,
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
      icon: moduleConfig.icon,
      tasks: moduleConfig.tests.map((description, testIndex) => ({
        id: createTaskId(selectedCommunity.id, `module-${moduleConfig.id}`, testIndex),
        description,
      })),
    });
  });

  return Object.values(phases).sort((a, b) => a.phaseNumber - b.phaseNumber);
}
