import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';
import { getFinalStatusClasses, getApprovalBlockers, getApprovalSummaryText } from '../utils/report.js';

export default function ApprovalPanel({ checklistByPhases, taskResults, summary, finalLabStatus }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (summary.total === 0) return null;

  const blockers = getApprovalBlockers(checklistByPhases, taskResults);
  const summaryText = getApprovalSummaryText(summary, finalLabStatus);

  return (
    <section className={`mt-5 rounded-xl border p-4 ${getFinalStatusClasses(finalLabStatus)}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-white/60 p-2">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-black uppercase tracking-wide">
            Módulo de Aprobación
          </h4>
          <p className="mt-1 text-sm font-semibold leading-5">
            {summaryText}
          </p>

          {blockers.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsExpanded(prev => !prev)}
                className="flex items-center gap-1.5 text-xs font-black underline-offset-2 hover:underline"
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {isExpanded ? 'Ocultar' : 'Ver'} {blockers.length} {blockers.length === 1 ? 'pendiente para aprobar' : 'pendientes para aprobar'}
              </button>

              {isExpanded && (
                <ul className="mt-2 space-y-1.5">
                  {blockers.map(blocker => (
                    <li key={`${blocker.phaseName}-${blocker.deviceName}`} className="rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold">
                      <span className="font-black">{blocker.deviceName}</span>
                      <span className="text-slate-500"> ({blocker.phaseName})</span>
                      {' — '}
                      {[
                        blocker.fail > 0 ? `${blocker.fail} Fail` : null,
                        blocker.blocked > 0 ? `${blocker.blocked} Blocked` : null,
                        blocker.pending > 0 ? `${blocker.pending} pendiente(s)` : null,
                      ].filter(Boolean).join(', ')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
