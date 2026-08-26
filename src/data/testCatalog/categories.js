/**
 * Test Categories - Estratificación de pruebas por criticidad
 * Permite generar diferentes niveles de cobertura (Smoke, Standard, Comprehensive)
 */

export const TEST_CATEGORIES = {
  CRITICAL: {
    id: 'CRITICAL',
    label: '🔴 Crítico',
    description: 'Sistema no funciona sin esto. Bloquea todo.',
    estimatedTime: '5-10 min',
    color: '#dc2626',
  },
  CORE: {
    id: 'CORE',
    label: '🟡 Core',
    description: 'Funcionalidad principal, debe funcionar.',
    estimatedTime: '15-30 min',
    color: '#d97706',
  },
  EXTENDED: {
    id: 'EXTENDED',
    label: '⚪ Extended',
    description: 'Casos de borde y funcionalidad avanzada.',
    estimatedTime: '30-60 min',
    color: '#64748b',
  },
  REGRESSION: {
    id: 'REGRESSION',
    label: '🧪 Regression',
    description: 'Validaciones específicas del sistema actual.',
    estimatedTime: 'Variable',
    color: '#6366f1',
  },
};

export const TEST_SUITES = {
  SMOKE: {
    id: 'SMOKE',
    name: 'Smoke (Rápido)',
    description: 'Solo pruebas críticas',
    categories: ['CRITICAL'],
    estimatedDuration: 8,
    icon: '⚡',
  },
  STANDARD: {
    id: 'STANDARD',
    name: 'Standard (Recomendado)',
    description: 'Crítico + Core',
    categories: ['CRITICAL', 'CORE'],
    estimatedDuration: 40,
    icon: '✅',
  },
  COMPREHENSIVE: {
    id: 'COMPREHENSIVE',
    name: 'Comprehensive (Completo)',
    description: 'Todas las pruebas',
    categories: ['CRITICAL', 'CORE', 'EXTENDED', 'REGRESSION'],
    estimatedDuration: 180,
    icon: '🔬',
  },
};
