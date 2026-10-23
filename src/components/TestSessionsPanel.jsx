import React, { useEffect, useState } from 'react';
import { Play, Plus, Square, Timer, Trash2 } from 'lucide-react';
import {
  createTestSession,
  formatDuration,
  getActiveSession,
  getSessionDurationMs,
  getTotalTestingMs,
  isoToLocalInput,
  isSessionRangeInvalid,
  localInputToIso,
  sortSessions,
} from '../utils/testSessions.js';

// Refresca el contador mientras hay una sesión en curso. No hace falta más
// precisión que el minuto: es lo que se muestra.
function useNowWhileActive(isActive) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!isActive) return undefined;
    setNow(new Date());
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, [isActive]);

  return now;
}

// Para cargar una sesión que ya pasó (ej. se empezó a probar antes de tener
// el panel, o se olvidó apretar Iniciar/Terminar) sin tener que crearla
// "ahora" y después corregirle las dos horas.
function ManualSessionForm({ onCancel, onSubmit }) {
  const [startInput, setStartInput] = useState(() => {
    const defaultStart = new Date();
    defaultStart.setHours(9, 0, 0, 0);
    return isoToLocalInput(defaultStart.toISOString());
  });
  const [endInput, setEndInput] = useState(() => isoToLocalInput(new Date().toISOString()));

  const startedAt = localInputToIso(startInput);
  const endedAt = localInputToIso(endInput);
  const isInvalid = Boolean(startedAt && endedAt && new Date(endedAt) < new Date(startedAt));
  const canSubmit = Boolean(startedAt && endedAt) && !isInvalid;

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-blue-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5 font-semibold text-slate-500">
          Inicio
          <input
            type="datetime-local"
            value={startInput}
            onChange={event => setStartInput(event.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex items-center gap-1.5 font-semibold text-slate-500">
          Término
          <input
            type="datetime-local"
            value={endInput}
            onChange={event => setEndInput(event.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
          />
        </label>
        {isInvalid && <span className="font-bold text-red-600">El término es anterior al inicio</span>}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-black text-slate-500 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ ...createTestSession(startedAt), endedAt })}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Agregar sesión
        </button>
      </div>
    </div>
  );
}

export default function TestSessionsPanel({
  sessions = [],
  readOnly = false,
  onStart,
  onStop,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const [showManualForm, setShowManualForm] = useState(false);
  const activeSession = getActiveSession(sessions);
  const now = useNowWhileActive(Boolean(activeSession));
  const orderedSessions = sortSessions(sessions);
  const totalMs = getTotalTestingMs(sessions, now);

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">Tiempo de pruebas</h3>
            <p className="text-xs font-medium text-slate-500">
              {sessions.length === 0
                ? 'Sin sesiones registradas. Marca el inicio al empezar a probar y el término al parar.'
                : `${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'} · Total: ${formatDuration(totalMs)}`}
              {activeSession && <span className="ml-1 font-black text-green-700">· En curso</span>}
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowManualForm(prev => !prev)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Agregar sesión manual
            </button>
            {activeSession ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-red-700"
              >
                <Square className="h-4 w-4" />
                Terminar sesión
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-green-700"
              >
                <Play className="h-4 w-4" />
                Iniciar sesión de pruebas
              </button>
            )}
          </div>
        )}
      </div>

      {showManualForm && !readOnly && (
        <ManualSessionForm
          onCancel={() => setShowManualForm(false)}
          onSubmit={session => {
            onAdd(session);
            setShowManualForm(false);
          }}
        />
      )}

      {orderedSessions.length > 0 && (
        <ul className="mt-3 space-y-2">
          {orderedSessions.map((session, index) => {
            const isInvalid = isSessionRangeInvalid(session);

            return (
              <li
                key={session.id}
                className={`flex flex-col gap-2 rounded-lg border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
                  isInvalid ? 'border-red-300' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-black text-slate-500">#{index + 1}</span>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-500">
                    Inicio
                    <input
                      type="datetime-local"
                      value={isoToLocalInput(session.startedAt)}
                      disabled={readOnly}
                      onChange={event => {
                        const iso = localInputToIso(event.target.value);
                        if (iso) onUpdate(session.id, { startedAt: iso });
                      }}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-50"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-500">
                    Término
                    {session.endedAt ? (
                      <input
                        type="datetime-local"
                        value={isoToLocalInput(session.endedAt)}
                        disabled={readOnly}
                        onChange={event => {
                          const iso = localInputToIso(event.target.value);
                          if (iso) onUpdate(session.id, { endedAt: iso });
                        }}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-50"
                      />
                    ) : (
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 font-black text-green-700">
                        En curso
                      </span>
                    )}
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  {isInvalid ? (
                    <span className="text-xs font-bold text-red-600">El término es anterior al inicio</span>
                  ) : (
                    <span className="text-xs font-black text-slate-700">
                      {formatDuration(getSessionDurationMs(session, now))}
                    </span>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onDelete(session.id)}
                      title="Eliminar sesión"
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
