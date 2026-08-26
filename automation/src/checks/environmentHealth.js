/**
 * Primer chequeo automatizable real: confirmar que los servicios cloud de
 * Certificación están arriba y responden ANTES de arrancar una sesión de
 * QA en terreno. Reemplaza el "¿está caído el ambiente?" manual que hoy se
 * descubre a mitad de las pruebas.
 *
 * Mapea a la prueba de catálogo (deviceCatalog.jsx -> controller.tests):
 * "Conexión a red LAN/WiFi activa y estable." /
 * "Servicios Smartki activos después de reinicio controlado."
 * — acá se valida el lado cloud, no el controlador físico.
 */
export async function checkServiceReachable(name, url) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    return {
      name,
      url,
      ok: response.status < 500,
      status: response.status,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name,
      url,
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      error: error.message,
    };
  }
}

export async function runEnvironmentHealthCheck(config) {
  const targets = [
    { name: 'Smartki API (Certificación)', url: config.smartkiApiBaseUrl },
    { name: 'Smartki Activity API (Certificación)', url: config.smartkiActivityBaseUrl },
    { name: 'Smartki Dashboard (Certificación)', url: config.smartkiDashBaseUrl },
    { name: 'Cooper (Certificación)', url: config.cooperDashBaseUrl },
  ];

  const results = await Promise.all(
    targets.map(target => checkServiceReachable(target.name, target.url))
  );

  return {
    checkedAt: new Date().toISOString(),
    environment: 'certificacion',
    allOk: results.every(result => result.ok),
    results,
  };
}
