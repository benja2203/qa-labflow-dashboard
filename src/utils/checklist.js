import { DEVICE_CATALOG } from '../data/deviceCatalog.jsx';
import {
  CAMERA_CAPABLE_TYPES,
  CARD_READER_CAPABLE_TYPES,
  getDirectionLabel,
  getRelaysLabel,
  getRelaySourceLabel,
} from '../constants/accessConfig.js';
import {
  getBaseTestsForDevice,
  getTestsForSuite,
  TEST_SUITES,
} from '../data/testCatalog/index.js';
import { buildDynamicTests as buildDynamicTestsFromBuilder } from './dynamicTestsBuilder.js';

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

/**
 * Obtener pruebas base para un dispositivo
 * Primero intenta cargar del nuevo catálogo JSON
 * Si no existe, fallback a DEVICE_CATALOG (backward compatibility)
 */
function getBaseTests(deviceType) {
  const newCatalogTests = getBaseTestsForDevice(deviceType);
  if (newCatalogTests.length > 0) {
    return newCatalogTests;
  }
  // Fallback a catálogo antiguo
  const catalogEntry = DEVICE_CATALOG[deviceType];
  return catalogEntry?.tests || [];
}

/**
 * Convertir pruebas del nuevo formato (objetos) al formato antiguo (strings)
 * para backward compatibility
 */
function convertTestObjectsToStrings(tests) {
  return tests.map(test => {
    if (typeof test === 'string') {
      return test; // Ya es string (formato antiguo)
    }
    // Es un objeto del nuevo catálogo, extraer título
    return test.title || test.description || '';
  });
}

/**
 * Wrapper que combina pruebas base + dinámicas
 * Maneja tanto el nuevo formato como el antiguo
 */
function buildDynamicTests(selectedCommunity, peripheralType, baseTests, instance) {
  // Primero agregar las dinámicas del nuevo sistema
  const dynamicTestObjects = buildDynamicTestsFromBuilder(
    selectedCommunity,
    peripheralType,
    [], // pasar array vacío, la lógica construye desde cero
    instance
  );

  // Convertir a strings para compatibilidad
  const dynamicTestStrings = convertTestObjectsToStrings(dynamicTestObjects);

  // Convertir baseTests si son objetos
  const baseTestStrings = convertTestObjectsToStrings(baseTests);

  // Combinar todas las pruebas
  return [...baseTestStrings, ...dynamicTestStrings];
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

/**
 * Construir checklist por fases
 * @param {Object} selectedCommunity - Comunidad seleccionada
 * @param {string} testSuiteType - Tipo de suite (SMOKE, STANDARD, COMPREHENSIVE)
 *                                  Si no se proporciona, genera TODAS las pruebas (backward compatible)
 * @returns {Array} Array de fases con dispositivos y pruebas
 */
export function buildChecklistByPhases(selectedCommunity, testSuiteType = 'STANDARD') {
  if (!selectedCommunity?.nodes?.length) return [];

  const phases = {};

  selectedCommunity.nodes.forEach(node => {
    const hubCatalog = DEVICE_CATALOG[node.type];
    if (!hubCatalog) return;

    initPhase(phases, hubCatalog.phase, hubCatalog.phaseName);

    // Obtener pruebas para el controller
    // Si existe en nuevo catálogo y se especifica suite, filtrar por suite
    let controllerTests = getBaseTests('controller');
    if (testSuiteType && testSuiteType !== 'ALL' && controllerTests.length > 0 && controllerTests[0]?.category) {
      // Son objetos del nuevo catálogo, filtrar por suite
      const filteredTests = getTestsForSuite('controller', testSuiteType);
      controllerTests = filteredTests.length > 0 ? filteredTests : controllerTests;
    }

    phases[hubCatalog.phase].devices.push({
      id: `community-${selectedCommunity.id}-${node.id}`,
      deviceName: `${hubCatalog.name} (${node.label})`,
      type: hubCatalog.id,
      typeName: hubCatalog.name,
      icon: hubCatalog.icon,
      tasks: controllerTests.map((testData, testIndex) => {
        const description = typeof testData === 'string' ? testData : testData.title || '';
        return {
          id: createTaskId(selectedCommunity.id, `${node.id}-controller`, testIndex),
          description,
        };
      }),
    });

    (node.peripherals || []).forEach(peripheralConfig => {
      const peripheralCatalog = DEVICE_CATALOG[peripheralConfig.type];
      if (!peripheralCatalog) return;

      initPhase(phases, peripheralCatalog.phase, peripheralCatalog.phaseName);

      const qty = Number(peripheralConfig.qty) || 1;

      for (let index = 0; index < qty; index += 1) {
        const instance = getPeripheralInstance(peripheralConfig, index);

        // Obtener pruebas base - preferir nuevo catálogo si existe
        let baseTests = getBaseTests(peripheralConfig.type);
        if (testSuiteType && testSuiteType !== 'ALL' && baseTests.length > 0 && baseTests[0]?.category) {
          // Son objetos del nuevo catálogo, filtrar por suite
          const filteredTests = getTestsForSuite(peripheralConfig.type, testSuiteType);
          baseTests = filteredTests.length > 0 ? filteredTests : baseTests;
        }

        // Agregar pruebas dinámicas
        const allTests = buildDynamicTests(
          selectedCommunity,
          peripheralConfig.type,
          baseTests,
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
          tasks: allTests.map((description, testIndex) => ({
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
