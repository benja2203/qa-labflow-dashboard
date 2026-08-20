import React, { useState } from 'react';
import { CheckCircle2, CloudOff, Loader2, Pencil, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import SignaturePad from './SignaturePad.jsx';

const BACKUP_STATUS_CONFIG = {
  sending: { icon: Loader2, spin: true, text: 'Enviando respaldo externo...', className: 'text-slate-500' },
  sent: { icon: CheckCircle2, text: 'Respaldo externo enviado', className: 'text-green-600' },
  failed: { icon: CloudOff, text: 'No se pudo enviar el respaldo externo — quedó guardado solo local', className: 'text-red-600' },
  'not-configured': { icon: CloudOff, text: 'Respaldo externo no configurado (Sidebar → Respaldo externo de excepciones)', className: 'text-slate-400' },
};

function formatUpdatedAt(value) {
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

function ExceptionForm({ initialValues, onCancel, onSubmit }) {
  const [authorizedBy, setAuthorizedBy] = useState(initialValues?.authorizedBy || '');
  const [reason, setReason] = useState(initialValues?.reason || '');
  const [signatureDataUrl, setSignatureDataUrl] = useState(initialValues?.signatureDataUrl || '');

  const canSubmit = authorizedBy.trim() && reason.trim() && signatureDataUrl;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ authorizedBy: authorizedBy.trim(), reason: reason.trim(), signatureDataUrl });
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-orange-200 bg-white p-3 shadow-inner">
      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
          Autorizado por
        </label>
        <input
          type="text"
          value={authorizedBy}
          onChange={event => setAuthorizedBy(event.target.value)}
          placeholder="Nombre de quien autoriza la entrega"
          className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/50"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
          Motivo
        </label>
        <textarea
          value={reason}
          onChange={event => setReason(event.target.value)}
          placeholder="Por qué se entrega igual (ej. plazo comprometido con el cliente, fallas menores a resolver en visita de soporte)."
          className="h-20 w-full resize-none rounded-md border border-slate-200 bg-white p-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/50"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
          Firma de quien autoriza
        </label>
        <SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} />
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
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar excepción
        </button>
      </div>
    </div>
  );
}

export default function DeliveryDecision({ finalLabStatus, deliveryException, onSetException, onClearException, onRetryBackup }) {
  const [isEditing, setIsEditing] = useState(false);
  const isExceptionActive = Boolean(deliveryException?.active);

  if (finalLabStatus === 'APTO' && !isExceptionActive) return null;

  return (
    <section className="mt-5 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-white/70 p-2 text-orange-600">
          <ShieldAlert className="h-5 w-5" />
        </div>

        <div className="flex-1">
          {isExceptionActive && !isEditing ? (
            <>
              <h4 className="text-sm font-black uppercase tracking-wide text-orange-800">
                Entregado bajo excepción
              </h4>
              <p className="mt-1 text-sm font-semibold leading-5 text-orange-900">
                Autorizado por: {deliveryException.authorizedBy}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-orange-900">
                Motivo: {deliveryException.reason}
              </p>
              {deliveryException.signatureDataUrl && (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-orange-200 bg-white p-2.5">
                  <img
                    src={deliveryException.signatureDataUrl}
                    alt="Firma de quien autoriza"
                    className="h-11 w-32 shrink-0 object-contain"
                  />
                  <p className="text-[11px] text-orange-700">
                    Firmado{deliveryException.updatedAt ? ` el ${formatUpdatedAt(deliveryException.updatedAt)}` : ''} desde este dispositivo.
                  </p>
                </div>
              )}
              {deliveryException.updatedAt && (
                <p className="mt-1 text-xs font-medium text-orange-700">
                  Registrado: {formatUpdatedAt(deliveryException.updatedAt)}
                </p>
              )}
              {deliveryException.backupStatus && (() => {
                const config = BACKUP_STATUS_CONFIG[deliveryException.backupStatus];
                if (!config) return null;
                const Icon = config.icon;
                const canRetry = ['failed', 'not-configured'].includes(deliveryException.backupStatus);
                return (
                  <div className={`mt-1.5 flex items-center gap-1.5 text-xs font-semibold ${config.className}`}>
                    <Icon className={`h-3.5 w-3.5 ${config.spin ? 'animate-spin' : ''}`} />
                    {config.text}
                    {canRetry && onRetryBackup && (
                      <button
                        type="button"
                        onClick={onRetryBackup}
                        className="ml-1 inline-flex items-center gap-1 rounded-md border border-current px-1.5 py-0.5 text-[10px] font-black hover:bg-white"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        Reintentar
                      </button>
                    )}
                  </div>
                );
              })()}
              <p className="mt-2 text-xs font-medium text-orange-700">
                El estado técnico ({finalLabStatus}) no cambia: esto solo deja constancia de que se entregó igual, a pesar de pruebas pendientes/fallidas.
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-black text-orange-700 transition-colors hover:bg-orange-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={onClearException}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-black text-orange-700 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Quitar excepción
                </button>
              </div>
            </>
          ) : isEditing ? (
            <>
              <h4 className="text-sm font-black uppercase tracking-wide text-orange-800">
                {isExceptionActive ? 'Editar excepción de entrega' : 'Registrar entrega bajo excepción'}
              </h4>
              <ExceptionForm
                initialValues={deliveryException}
                onCancel={() => setIsEditing(false)}
                onSubmit={values => {
                  onSetException(values);
                  setIsEditing(false);
                }}
              />
            </>
          ) : (
            <>
              <h4 className="text-sm font-black uppercase tracking-wide text-orange-800">
                El proyecto no está Apto todavía
              </h4>
              <p className="mt-1 text-sm font-semibold leading-5 text-orange-900">
                Si igual se va a entregar por una decisión de negocio (plazos, urgencia del cliente, etc.), podés dejarlo registrado sin alterar el estado técnico.
              </p>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-orange-700"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Marcar entrega bajo excepción
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
