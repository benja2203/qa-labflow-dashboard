import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Save, X, XCircle } from 'lucide-react';
import { sendExceptionBackup } from '../utils/externalBackup.js';

export default function BackupSettingsModal({ webhookUrl, onSave, onClose }) {
  const [value, setValue] = useState(webhookUrl || '');
  const [testState, setTestState] = useState(null); // null | 'testing' | 'ok' | 'error'

  const handleTest = async () => {
    setTestState('testing');
    const result = await sendExceptionBackup(value, {
      type: 'ping',
      message: 'Prueba de conexión desde QA LabFlow',
      sentAt: new Date().toISOString(),
    });
    setTestState(result.sent ? 'ok' : 'error');
  };

  const handleSave = () => {
    onSave(value.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-base font-black text-slate-800">Respaldo externo de excepciones</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-slate-600">
            Cuando registrás una "entrega bajo excepción", además de guardarse acá se puede
            enviar una copia a una planilla de Google Sheets tuya — así queda un registro con
            fecha fuera de este navegador. Pegá acá la URL del Web App de Apps Script (ver la
            guía de configuración que te dejamos aparte).
          </p>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              URL del Web App
            </label>
            <input
              type="text"
              value={value}
              onChange={event => { setValue(event.target.value); setTestState(null); }}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={!value.trim() || testState === 'testing'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testState === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              Probar conexión
            </button>

            {testState === 'ok' && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Se envió correctamente
              </span>
            )}
            {testState === 'error' && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                <XCircle className="h-3.5 w-3.5" />
                No se pudo enviar — revisá la URL y que el Web App esté publicado
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Dejar este campo vacío es válido: el registro sigue guardándose local, simplemente
            sin la copia externa.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-black text-slate-500 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-blue-700"
          >
            <Save className="h-3.5 w-3.5" />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
