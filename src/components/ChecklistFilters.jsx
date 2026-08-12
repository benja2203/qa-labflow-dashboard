import React from 'react';
import { CheckCircle2, Filter, X } from 'lucide-react';
import { TEST_STATUS, TEST_STATUS_ORDER } from '../constants/testStatus.js';

function FilterChip({ active, onClick, activeClassName, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-black transition-all ${
        active
          ? activeClassName || 'border-blue-300 bg-blue-100 text-blue-700'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function ProgressChip({ active, isComplete, done, total, onClick, children }) {
  const showAsComplete = isComplete && !active;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${done}/${total} pruebas resueltas`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition-all ${
        active
          ? 'border-blue-300 bg-blue-100 text-blue-700'
          : showAsComplete
            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
      }`}
    >
      {isComplete && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />}
      {children}
      <span className={`font-normal ${active ? 'opacity-80' : showAsComplete ? 'text-green-600' : 'text-slate-400'}`}>
        ({done}/{total})
      </span>
    </button>
  );
}

export default function ChecklistFilters({
  selectedStatuses,
  onToggleStatus,
  phaseOptions,
  selectedPhases,
  onTogglePhase,
  deviceTypeOptions,
  selectedDeviceTypes,
  onToggleDeviceType,
  onClearFilters,
  hasActiveFilters,
  visibleCount,
  totalCount,
}) {
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-black text-slate-700">
          <Filter className="h-4 w-4" />
          Filtros
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">
              Mostrando {visibleCount} de {totalCount} pruebas
            </span>
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 transition-colors hover:bg-slate-50"
            >
              <X className="h-3 w-3" />
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Estado
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEST_STATUS_ORDER.map(statusKey => {
              const config = TEST_STATUS[statusKey];
              return (
                <FilterChip
                  key={statusKey}
                  active={selectedStatuses.includes(statusKey)}
                  onClick={() => onToggleStatus(statusKey)}
                  activeClassName={config.badge}
                >
                  {config.shortLabel}
                </FilterChip>
              );
            })}
          </div>
        </div>

        {phaseOptions.length > 1 && (
          <div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Fase
            </p>
            <div className="flex flex-wrap gap-1.5">
              {phaseOptions.map(phase => (
                <ProgressChip
                  key={phase.phaseNumber}
                  active={selectedPhases.includes(phase.phaseNumber)}
                  isComplete={phase.isComplete}
                  done={phase.done}
                  total={phase.total}
                  onClick={() => onTogglePhase(phase.phaseNumber)}
                >
                  {phase.phaseNumber}. {phase.phaseName.replace(/^Fase\s*\d+:\s*/i, '')}
                </ProgressChip>
              ))}
            </div>
          </div>
        )}

        {deviceTypeOptions.length > 1 && (
          <div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Dispositivo
            </p>
            <div className="flex flex-wrap gap-1.5">
              {deviceTypeOptions.map(deviceType => (
                <ProgressChip
                  key={deviceType.id}
                  active={selectedDeviceTypes.includes(deviceType.id)}
                  isComplete={deviceType.isComplete}
                  done={deviceType.done}
                  total={deviceType.total}
                  onClick={() => onToggleDeviceType(deviceType.id)}
                >
                  {deviceType.label}
                </ProgressChip>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
