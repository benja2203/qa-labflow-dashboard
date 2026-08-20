// Respaldo externo de la excepción de entrega: un envío best-effort a un
// Google Apps Script Web App (ver README/Apps Script provisto), para que
// quede una copia con timestamp fuera del localStorage del técnico. No hay
// forma de leer la respuesta con certeza total (limitación de CORS de Apps
// Script), así que esto es "se envió" en el mejor de los casos, nunca una
// confirmación criptográfica de entrega.
export async function sendExceptionBackup(webhookUrl, payload) {
  if (!webhookUrl?.trim()) {
    return { sent: false, reason: 'not-configured' };
  }

  try {
    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { sent: false, reason: 'http-error' };
    }

    return { sent: true };
  } catch {
    return { sent: false, reason: 'network-error' };
  }
}
