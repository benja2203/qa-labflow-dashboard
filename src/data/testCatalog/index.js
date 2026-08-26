/**
 * Test Catalog Loader
 * Carga dinámicamente los catálogos de pruebas de cada dispositivo
 * Mantiene la data separada de la lógica para mejor mantenibilidad
 */

// Importar catálogos JSON
import controllerCatalog from './controller.json';
import qrCatalog from './qr-reader.json';
import { TEST_CATEGORIES, TEST_SUITES } from './categories.js';

// Objeto central de todos los catálogos
const DEVICE_TEST_CATALOGS = {
  controller: controllerCatalog,
  qr: qrCatalog,
  // Los demás dispositivos se agregarán en fases posteriores
  // stickertag: stickertagCatalog,
  // facial: facialCatalog,
  // lpr: lprCatalog,
  // guardDesk: guardDeskCatalog,
  // guardPda: guardPdaCatalog,
  // hardbutton: hardbuttonCatalog,
  // invitaciones: invitacionesCatalog,
  // qrcarnet: qrcarnetCatalog,
  // remoto: remotoCatalog,
};

/**
 * Obtener todas las pruebas base de un dispositivo
 * @param {string} deviceType - Tipo de dispositivo (e.g., 'qr', 'controller')
 * @returns {Array} Array de pruebas o array vacío si no existe
 */
export function getBaseTestsForDevice(deviceType) {
  const catalog = DEVICE_TEST_CATALOGS[deviceType];
  return catalog ? catalog.tests : [];
}

/**
 * Obtener pruebas filtradas por categoría(s) de un dispositivo
 * @param {string} deviceType - Tipo de dispositivo
 * @param {string|string[]} categories - Categoría o array de categorías
 * @returns {Array} Pruebas que coinciden con las categorías
 */
export function getTestsByCategory(deviceType, categories) {
  const baseTests = getBaseTestsForDevice(deviceType);
  const categoryList = Array.isArray(categories) ? categories : [categories];

  return baseTests.filter(test => categoryList.includes(test.category));
}

/**
 * Obtener todas las pruebas de un dispositivo para un suite específico
 * @param {string} deviceType - Tipo de dispositivo
 * @param {string} suiteType - Tipo de suite (SMOKE, STANDARD, COMPREHENSIVE)
 * @returns {Array} Pruebas para ese suite
 */
export function getTestsForSuite(deviceType, suiteType = 'STANDARD') {
  const suite = TEST_SUITES[suiteType];
  if (!suite) {
    console.warn(`Suite ${suiteType} no existe. Usando STANDARD.`);
    return getTestsForSuite(deviceType, 'STANDARD');
  }

  return getTestsByCategory(deviceType, suite.categories);
}

/**
 * Obtener metadata de un dispositivo desde el catálogo
 * @param {string} deviceType - Tipo de dispositivo
 * @returns {Object} Metadata del dispositivo (name, description)
 */
export function getDeviceMetadata(deviceType) {
  const catalog = DEVICE_TEST_CATALOGS[deviceType];
  return catalog ? {
    device: catalog.device,
    name: catalog.name,
    description: catalog.description,
    totalTests: catalog.tests.length,
    testsCount: {
      CRITICAL: catalog.tests.filter(t => t.category === 'CRITICAL').length,
      CORE: catalog.tests.filter(t => t.category === 'CORE').length,
      EXTENDED: catalog.tests.filter(t => t.category === 'EXTENDED').length,
      REGRESSION: catalog.tests.filter(t => t.category === 'REGRESSION').length,
    }
  } : null;
}

/**
 * Calcular tiempo estimado total para un suite
 * @param {string} deviceType - Tipo de dispositivo
 * @param {string} suiteType - Tipo de suite
 * @returns {number} Minutos estimados
 */
export function estimateTestDuration(deviceType, suiteType = 'STANDARD') {
  const tests = getTestsForSuite(deviceType, suiteType);

  let totalMinutes = 0;
  tests.forEach(test => {
    // Parsear el estimatedTime (e.g., "5-10 min" → tomar promedio)
    if (typeof test.estimatedTime === 'number') {
      totalMinutes += test.estimatedTime;
    } else if (typeof test.estimatedTime === 'string') {
      const match = test.estimatedTime.match(/(\d+)/);
      if (match) {
        totalMinutes += parseInt(match[1]);
      }
    }
  });

  return Math.round(totalMinutes);
}

/**
 * Calcular estadísticas de automatización
 * @param {string} deviceType - Tipo de dispositivo
 * @returns {Object} Stats de automatización
 */
export function getAutomationStats(deviceType) {
  const tests = getBaseTestsForDevice(deviceType);
  const automatable = tests.filter(t => t.automatable).length;

  return {
    total: tests.length,
    automatable,
    manual: tests.length - automatable,
    percentage: tests.length > 0 ? Math.round((automatable / tests.length) * 100) : 0,
  };
}

/**
 * Obtener todas las dependencias de un test
 * @param {string} deviceType - Tipo de dispositivo
 * @param {string} testId - ID del test
 * @returns {Array} Array de IDs de tests de los que depende
 */
export function getTestDependencies(deviceType, testId) {
  const test = getBaseTestsForDevice(deviceType).find(t => t.id === testId);
  return test ? test.dependencies || [] : [];
}

/**
 * Verificar si un test está bloqueado por dependencias incompletas
 * @param {string} deviceType - Tipo de dispositivo
 * @param {string} testId - ID del test
 * @param {Object} taskResults - Resultados actuales de pruebas
 * @returns {boolean} true si está bloqueado
 */
export function isTestBlocked(deviceType, testId, taskResults) {
  const dependencies = getTestDependencies(deviceType, testId);

  // Construir task IDs esperados (asumiendo formato "community-X-device-Y-test-Z")
  // Nota: esto es un placeholder, ajustar según lógica real de IDs
  return dependencies.some(depId => {
    const depTaskId = `test-${depId}`; // Simplificado para esta prueba
    const depResult = taskResults[depTaskId];
    return !depResult || depResult.status === 'pending';
  });
}

/**
 * Exportar catálogos completos para debugging/análisis
 */
export const TEST_CATALOGS = DEVICE_TEST_CATALOGS;

export { TEST_CATEGORIES, TEST_SUITES };
