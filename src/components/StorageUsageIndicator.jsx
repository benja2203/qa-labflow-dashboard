import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HardDrive } from 'lucide-react';
import { ESTIMATED_QUOTA_BYTES, formatBytes, getStorageUsageBreakdown } from '../utils/storageUsage.js';

export default function StorageUsageIndicator() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { breakdown, totalBytes } = getStorageUsageBreakdown();
  const percentage = Math.min(100, (totalBytes / ESTIMATED_QUOTA_BYTES) * 100);

  const barColor = percentage >= 85
    ? 'bg-red-500'
    : percentage >= 60
      ? 'bg-amber-500'
      : 'bg-blue-500';

  const textColor = percentage >= 85
    ? 'text-red-600'
    : percentage >= 60
      ? 'text-amber-600'
      : 'text-slate-500';

  return (
    <div className="border-t border-slate-100 p-4">
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex w-full items-center gap-2 text-left"
      >
        <HardDrive className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="flex-1 text-[11px] font-bold text-slate-500">
          Almacenamiento local: <span className={textColor}>{formatBytes(totalBytes)}</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
      </button>

      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {percentage >= 60 && (
        <p className={`mt-1.5 text-[10px] font-semibold ${textColor}`}>
          {percentage >= 85
            ? 'Cerca del límite — archivá proyectos cerrados viejos para liberar espacio.'
            : 'Empezando a llenarse — considerá archivar proyectos cerrados que no uses.'}
        </p>
      )}

      {isExpanded && (
        <div className="mt-2.5 space-y-1.5">
          {breakdown.filter(item => item.bytes > 0).map(item => (
            <div key={item.key} className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{item.label}</span>
              <span className="font-mono font-semibold text-slate-500">{formatBytes(item.bytes)}</span>
            </div>
          ))}
          {breakdown.every(item => item.bytes === 0) && (
            <p className="text-[10px] italic text-slate-400">Sin datos guardados todavía.</p>
          )}
        </div>
      )}
    </div>
  );
}
