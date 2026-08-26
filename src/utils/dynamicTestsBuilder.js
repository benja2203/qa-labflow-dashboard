/**
 * Dynamic Tests Builder
 * Construye pruebas dinámicas que se agregan a las pruebas base según
 * configuración de reglas avanzadas (Anti-Passback, Multivalidación, etc.)
 */

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

/**
 * Construir pruebas dinámicas que se agregan según reglas y configuración
 * @param {Object} selectedCommunity - Comunidad actual
 * @param {string} peripheralType - Tipo de periférico
 * @param {Array} baseTests - Pruebas base del catálogo
 * @param {Object} instance - Instancia del periférico
 * @returns {Array} Array de pruebas dinámicas generadas
 */
export function buildDynamicTests(selectedCommunity, peripheralType, baseTests, instance) {
  const dynamicTests = [];
  const rules = selectedCommunity?.rules || {};
  const enabledModules = Array.isArray(selectedCommunity?.modules) ? selectedCommunity.modules : [];

  // ============================================
  // REGLA: Anti-Passback
  // ============================================
  const antipassbackDoorIds = Array.isArray(rules.antipassbackDoorIds) ? rules.antipassbackDoorIds : [];
  const doorHasAntipassback = rules.antipassback &&
    instance?.doorId &&
    antipassbackDoorIds.includes(instance.doorId);

  if (doorHasAntipassback && ACCESS_DEVICES.includes(peripheralType)) {
    const direction = instance?.direction || '';
    const handlesEntry = direction !== 'salida';

    if (handlesEntry) {
      dynamicTests.push(
        {
          id: `${peripheralType}-apb-001`,
          title: '[Anti-Passback] Intento de doble entrada sin salida previa → acceso denegado',
          description: 'Verificar que no se permite entrar dos veces sin haber salido',
          category: 'REGRESSION',
          automatable: false,
          tags: ['anti-passback', 'security', 'regression'],
          estimatedTime: 10,
          dependencies: [`${peripheralType}-001`],
        },
        {
          id: `${peripheralType}-apb-002`,
          title: '[Anti-Passback] Flujo correcto entrada → salida → entrada funciona sin problemas',
          description: 'Validar que el flujo normal entrada-salida-entrada es permitido',
          category: 'REGRESSION',
          automatable: false,
          tags: ['anti-passback', 'regression'],
          estimatedTime: 15,
          dependencies: [`${peripheralType}-001`],
        }
      );
    } else {
      dynamicTests.push(
        {
          id: `${peripheralType}-apb-exit`,
          title: '[Anti-Passback] Verificar que la salida siempre es permitida',
          description: 'Confirmar que Anti-Passback no bloquea el egreso',
          category: 'REGRESSION',
          automatable: false,
          tags: ['anti-passback', 'regression'],
          estimatedTime: 5,
          dependencies: [`${peripheralType}-001`],
        }
      );
    }

    dynamicTests.push(
      {
        id: `${peripheralType}-apb-log`,
        title: '[Anti-Passback] Registro de evento Anti-Passback visible en logs',
        description: 'Verificar que los eventos de Anti-Passback quedan registrados',
        category: 'REGRESSION',
        automatable: true,
        tags: ['anti-passback', 'logging', 'regression'],
        estimatedTime: 3,
        dependencies: [`${peripheralType}-apb-001`],
      }
    );
  }

  // ============================================
  // REGLA: Cancelar Invitación
  // ============================================
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
        {
          id: `${peripheralType}-cinv-001`,
          title: '[Cancelar Invitación] Ingreso con visita válida → acceso concedido y credencial invalidada',
          description: 'Verificar que tras usar una invitación, esta queda cancelada',
          category: 'REGRESSION',
          automatable: false,
          tags: ['cancel-invitation', 'regression', 'temporary-credentials'],
          estimatedTime: 10,
          dependencies: [`${peripheralType}-001`],
        },
        {
          id: `${peripheralType}-cinv-002`,
          title: '[Cancelar Invitación] Reintento con misma credencial → acceso denegado',
          description: 'Validar que la credencial cancelada no funciona más',
          category: 'REGRESSION',
          automatable: false,
          tags: ['cancel-invitation', 'regression'],
          estimatedTime: 5,
          dependencies: [`${peripheralType}-cinv-001`],
        }
      );
    } else {
      dynamicTests.push(
        {
          id: `${peripheralType}-cinv-exit`,
          title: '[Cancelar Invitación] Verificar que la salida siempre es permitida',
          description: 'Confirmar que no bloquea el egreso',
          category: 'REGRESSION',
          automatable: false,
          tags: ['cancel-invitation', 'regression'],
          estimatedTime: 5,
          dependencies: [`${peripheralType}-001`],
        }
      );
    }

    dynamicTests.push(
      {
        id: `${peripheralType}-cinv-log`,
        title: '[Cancelar Invitación] Registro del evento visible en logs',
        description: 'Verificar auditoría de cancelación de credenciales',
        category: 'REGRESSION',
        automatable: true,
        tags: ['cancel-invitation', 'logging', 'regression'],
        estimatedTime: 3,
        dependencies: [`${peripheralType}-cinv-001`],
      }
    );
  }

  // ============================================
  // REGLA: Multivalidación
  // ============================================
  if (rules.multivalidation && rules.multiFactors?.includes(peripheralType)) {
    const factorNames = rules.multiFactors
      .map(id => DEVICE_CATALOG[id]?.name)
      .filter(Boolean)
      .join(' + ');

    dynamicTests.push(
      {
        id: `${peripheralType}-mv-001`,
        title: `[Multi Validación] Confirmar factores configurados: ${factorNames}`,
        description: 'Verificar que los factores múltiples están correctamente configurados',
        category: 'REGRESSION',
        automatable: true,
        tags: ['multivalidation', 'configuration', 'regression'],
        estimatedTime: 5,
        dependencies: [`${peripheralType}-001`],
      },
      {
        id: `${peripheralType}-mv-002`,
        title: '[Multi Validación] Acceso con todos los factores correctos → ingreso concedido',
        description: 'Validar que con todos los factores se concede acceso',
        category: 'REGRESSION',
        automatable: false,
        tags: ['multivalidation', 'happy-path', 'regression'],
        estimatedTime: 10,
        dependencies: [`${peripheralType}-mv-001`],
      },
      {
        id: `${peripheralType}-mv-003`,
        title: '[Multi Validación] Acceso con solo uno de los factores → acceso denegado',
        description: 'Verificar que falta un factor bloquea el acceso',
        category: 'REGRESSION',
        automatable: false,
        tags: ['multivalidation', 'security', 'regression'],
        estimatedTime: 10,
        dependencies: [`${peripheralType}-mv-001`],
      },
      {
        id: `${peripheralType}-mv-004`,
        title: '[Multi Validación] Tiempo de espera entre validaciones respetado',
        description: 'Confirmar que hay un timeout entre intentos de validación',
        category: 'REGRESSION',
        automatable: false,
        tags: ['multivalidation', 'timing', 'regression'],
        estimatedTime: 10,
        dependencies: [`${peripheralType}-mv-001`],
      },
      {
        id: `${peripheralType}-mv-005`,
        title: '[Multi Validación] Registro del evento en el sistema',
        description: 'Verificar auditoría de multivalidación',
        category: 'REGRESSION',
        automatable: true,
        tags: ['multivalidation', 'logging', 'regression'],
        estimatedTime: 3,
        dependencies: [`${peripheralType}-mv-002`],
      }
    );
  }

  // ============================================
  // CONFIGURACIÓN: Cámara Integrada
  // ============================================
  if (instance?.cameraEnabled && CAMERA_CAPABLE_TYPES.includes(peripheralType)) {
    const camRef = instance.cameraIp ? ` (${instance.cameraIp})` : '';

    dynamicTests.push(
      {
        id: `${peripheralType}-cam-001`,
        title: `[Cámara IP${camRef}] Verificar que la cámara captura imagen al accionar el dispositivo`,
        description: 'Validar captura de imagen en cada intento de acceso',
        category: 'CORE',
        automatable: true,
        tags: ['camera', 'capture', 'core'],
        estimatedTime: 5,
        dependencies: [`${peripheralType}-002`],
      },
      {
        id: `${peripheralType}-cam-002`,
        title: `[Cámara IP${camRef}] Imagen capturada está clara y con buena iluminación`,
        description: 'Verificar calidad de las capturas',
        category: 'EXTENDED',
        automatable: false,
        tags: ['camera', 'quality', 'manual-only'],
        estimatedTime: 10,
        dependencies: [`${peripheralType}-cam-001`],
      }
    );
  }

  // ============================================
  // CONFIGURACIÓN: Lector de Tarjeta
  // ============================================
  if (instance?.cardReaderEnabled && CARD_READER_CAPABLE_TYPES.includes(peripheralType)) {
    dynamicTests.push(
      {
        id: `${peripheralType}-card-001`,
        title: '[Lector de Tarjeta] Tarjeta válida registrada → acceso concedido',
        description: 'Verificar lectura y validación de tarjeta',
        category: 'CORE',
        automatable: false,
        tags: ['card-reader', 'core'],
        estimatedTime: 5,
        dependencies: [`${peripheralType}-001`],
      },
      {
        id: `${peripheralType}-card-002`,
        title: '[Lector de Tarjeta] Tarjeta no registrada → acceso denegado',
        description: 'Validar seguridad de tarjetas desconocidas',
        category: 'CORE',
        automatable: false,
        tags: ['card-reader', 'security', 'core'],
        estimatedTime: 5,
        dependencies: [`${peripheralType}-001`],
      }
    );
  }

  return dynamicTests;
}

/**
 * Contar cantidad de pruebas dinámicas que se generarán para una configuración
 * Útil para estimar el total de pruebas
 */
export function countDynamicTests(selectedCommunity, peripheralType, instance) {
  const baseTests = [];
  return buildDynamicTests(selectedCommunity, peripheralType, baseTests, instance).length;
}
