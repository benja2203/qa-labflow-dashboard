export const PROCESS_SCOPE = {
  id: 'proceso',
  label: 'Proceso / Documentación',
};

export function resolveObservationScopeLabel(id, deviceCatalog) {
  if (id === PROCESS_SCOPE.id) return PROCESS_SCOPE.label;
  return deviceCatalog[id]?.name || id;
}
