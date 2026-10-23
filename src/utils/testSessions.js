// Sesiones de prueba: cada vez que el técnico se sienta a probar registra
// inicio y término. Se guardan como lista (no un único inicio/fin) porque las
// pruebas se pueden cortar a mitad -- se manda un reporte parcial con lo que
// hay, y después se retoma en otra sesión y se manda el reporte actualizado.
// Una sesión sin `endedAt` es la que está en curso.

export function createTestSession(startedAt = new Date().toISOString()) {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt,
    endedAt: null,
  };
}

export function getActiveSession(sessions = []) {
  return sessions.find(session => !session.endedAt) || null;
}

// Una sesión con término anterior al inicio (error de tipeo al editar) no
// suma tiempo: se marca como inválida en la UI en vez de restar al total.
export function isSessionRangeInvalid(session) {
  if (!session?.startedAt || !session?.endedAt) return false;
  return new Date(session.endedAt).getTime() < new Date(session.startedAt).getTime();
}

export function getSessionDurationMs(session, now = new Date()) {
  if (!session?.startedAt) return 0;
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, end - start);
}

export function getTotalTestingMs(sessions = [], now = new Date()) {
  return sessions.reduce((total, session) => total + getSessionDurationMs(session, now), 0);
}

export function sortSessions(sessions = []) {
  return [...sessions].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

// Resumen para el reporte: cuándo se empezó a probar (primera sesión), cuándo
// se terminó (última sesión cerrada, o null si hay una en curso) y el tiempo
// efectivo sumado -- que no es lo mismo que fin - inicio cuando hubo pausas.
export function getTestingSummary(sessions = [], now = new Date()) {
  const ordered = sortSessions(sessions);
  if (ordered.length === 0) return null;

  const activeSession = getActiveSession(ordered);
  const lastEndedAt = ordered.reduce((latest, session) => (
    session.endedAt && (!latest || new Date(session.endedAt) > new Date(latest)) ? session.endedAt : latest
  ), null);

  return {
    sessions: ordered,
    firstStartedAt: ordered[0].startedAt,
    lastEndedAt: activeSession ? null : lastEndedAt,
    isActive: Boolean(activeSession),
    totalMs: getTotalTestingMs(ordered, now),
  };
}

export function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

export function formatSessionDateTime(value) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function formatSessionTime(value) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

// Texto de una línea para reporte: "20-10-2026 09:15 -> 12:40 (3 h 25 min)".
// Si termina otro día se muestra la fecha completa del término también.
export function describeSession(session, now = new Date()) {
  const start = formatSessionDateTime(session.startedAt);
  const duration = formatDuration(getSessionDurationMs(session, now));

  if (!session.endedAt) return `${start} -> en curso (${duration} hasta ahora)`;

  const sameDay = new Date(session.startedAt).toDateString() === new Date(session.endedAt).toDateString();
  const end = sameDay ? formatSessionTime(session.endedAt) : formatSessionDateTime(session.endedAt);
  return `${start} -> ${end} (${duration})`;
}

// <input type="datetime-local"> trabaja en hora local sin zona ("2026-10-20T09:15").
export function isoToLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function localInputToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
