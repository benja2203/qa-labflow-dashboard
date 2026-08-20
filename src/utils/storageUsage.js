// Estimación del uso de localStorage por este sitio. Los navegadores no dan
// una API directa para "cuánto ocupás" — se aproxima sumando el tamaño de
// las claves propias de la app (localStorage guarda UTF-16, ~2 bytes por
// carácter en la mayoría de los navegadores).
const STORAGE_KEYS = [
  { key: 'qa-labflow-communities', label: 'Comunidades (topología)' },
  { key: 'qa-labflow-task-results', label: 'Resultados de pruebas' },
  { key: 'qa-labflow-general-observations', label: 'Observaciones Generales' },
  { key: 'qa-labflow-delivery-exceptions', label: 'Excepciones de entrega' },
  { key: 'qa-labflow-closed-projects', label: 'Proyectos cerrados (fotos)' },
  { key: 'qa-labflow-device-notes', label: 'Notas de dispositivo' },
];

// Cuota de referencia conservadora: Safari históricamente limita a ~5MB por
// sitio, Chrome/Firefox dan más. Usamos la más chica para avisar temprano.
export const ESTIMATED_QUOTA_BYTES = 5 * 1024 * 1024;

function getKeyByteSize(key) {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return 0;
    return (key.length + value.length) * 2;
  } catch {
    return 0;
  }
}

export function getStorageUsageBreakdown() {
  const breakdown = STORAGE_KEYS.map(({ key, label }) => ({
    key,
    label,
    bytes: getKeyByteSize(key),
  })).sort((a, b) => b.bytes - a.bytes);

  const totalBytes = breakdown.reduce((sum, item) => sum + item.bytes, 0);

  return { breakdown, totalBytes };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
