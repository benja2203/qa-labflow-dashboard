import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { TEST_STATUS, TEST_STATUS_ORDER } from '../constants/testStatus.js';

function StatusIcon({ status, isRuleInjected }) {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === 'fail') return <XCircle className="h-5 w-5 text-red-500" />;
  if (status === 'blocked') return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  if (status === 'na') return <Circle className="h-5 w-5 text-slate-400" />;

  return (
    <Circle className={`h-5 w-5 transition-colors ${
      isRuleInjected ? 'text-indigo-300 group-hover:text-indigo-500' : 'text-slate-300 group-hover:text-blue-400'
    }`} />
  );
}

export default function TaskRow({
  task,
  taskResult,
  isCommentBoxOpen,
  setTaskStatus,
  toggleCommentBox,
  handleCommentChange,
  handleEvidenceChange,
}) {
  const currentStatus = taskResult.status;
  const hasComment = taskResult.comment?.trim().length > 0;
  const hasEvidence = taskResult.evidence?.trim().length > 0;
  const needsComment = ['fail', 'blocked'].includes(currentStatus) && !hasComment;
  const isRuleInjected = task.description.includes('[Anti-Passback]') || task.description.includes('[Multi Validación]');

  return (
    <div className={`group mb-1 rounded-lg transition-colors ${
      isRuleInjected
        ? 'mx-1.5 mb-1.5 border border-indigo-100/50 bg-indigo-50/50 hover:bg-indigo-100/50'
        : 'hover:bg-slate-50'
    }`}>
      <div className="flex items-start justify-between p-3">
        <div className="flex flex-1 items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <StatusIcon status={currentStatus} isRuleInjected={isRuleInjected} />
          </div>

          <div className="min-w-0 flex-1">
            <p className={`select-none text-sm font-medium leading-tight transition-colors ${
              currentStatus === 'pass'
                ? 'text-slate-400 line-through'
                : isRuleInjected
                  ? 'font-semibold text-indigo-900'
                  : 'text-slate-700'
            }`}>
              {task.description}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {TEST_STATUS_ORDER.map(statusKey => {
                const statusConfig = TEST_STATUS[statusKey];
                const isActive = currentStatus === statusKey;

                return (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setTaskStatus(task.id, statusKey)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-black transition-all ${
                      isActive
                        ? statusConfig.badge
                        : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {statusConfig.shortLabel}
                  </button>
                );
              })}
            </div>

            {needsComment && (
              <div className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800">
                Este estado requiere observación técnica antes de cerrar el reporte.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleCommentBox(task.id)}
          className={`ml-4 rounded-md p-1.5 transition-colors ${
            hasComment || hasEvidence
              ? 'bg-red-50 text-red-500 hover:bg-red-100'
              : 'text-slate-300 hover:bg-slate-200 hover:text-slate-500'
          }`}
          title="Agregar observación o evidencia"
        >
          {hasComment || hasEvidence ? <AlertCircle className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
        </button>
      </div>

      {isCommentBoxOpen && (
        <div className="px-3 pb-3 pl-11">
          <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/50 p-3 shadow-inner">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-red-800">
                Observación / Detalle técnico
              </label>
              <textarea
                value={taskResult.comment || ''}
                onChange={event => handleCommentChange(task.id, event.target.value)}
                placeholder="Describe qué pasó. Ej: El lector QR no registra eventos en dashboard después de lectura válida."
                className="h-20 w-full resize-none rounded-md border border-red-200 bg-white p-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-700">
                Evidencia
              </label>
              <textarea
                value={taskResult.evidence || ''}
                onChange={event => handleEvidenceChange(task.id, event.target.value)}
                placeholder="Pega aquí logs, captura, número de ticket, respuesta API o link de evidencia."
                className="h-20 w-full resize-none rounded-md border border-slate-200 bg-white p-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
