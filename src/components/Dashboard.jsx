import React, { useState } from 'react';
import { Building, CheckCircle2, Download, FileText, RotateCcw, Settings2, Upload, Wrench } from 'lucide-react';
import { getFinalStatusClasses } from '../utils/report.js';
import PhaseSection from './PhaseSection.jsx';
import ApprovalPanel from './ApprovalPanel.jsx';
import TechnicalSheetModal from './TechnicalSheetModal.jsx';

function SummaryPill({ label, value, className }) {
  return (
    <div className={`rounded-full border px-3 py-1 text-xs font-black ${className}`}>
      {label}: {value}
    </div>
  );
}

export default function Dashboard({
  selectedCommunity,
  checklistByPhases,
  taskResults,
  summary,
  finalLabStatus,
  commentBoxes,
  getTaskResult,
  setTaskStatus,
  toggleCommentBox,
  handleCommentChange,
  handleEvidenceChange,
  toggleDeviceAllTasks,
  onShowReport,
  onResetChecklist,
  onExportJson,
  onEditCommunity,
  onImportJson,
  importStripResults,
  onToggleImportStripResults,
}) {
  const [showTechnicalSheet, setShowTechnicalSheet] = useState(false);

  return (
    <div>
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
              <Building className="h-4 w-4" />
              Checklist Activo
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-800">
              {selectedCommunity.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Validación de laboratorio/preinstalación para controladores, periféricos y reglas de acceso.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className={`rounded-xl border px-4 py-2.5 text-center text-sm font-black ${getFinalStatusClasses(finalLabStatus)}`}>
              {finalLabStatus}
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 shadow-inner">
              <div className="text-right">
                <div className="text-sm font-bold text-slate-700">Progreso Total</div>
                <div className="text-xs font-medium text-slate-500">
                  {summary.completed} de {summary.total} pruebas evaluadas
                </div>
              </div>

              <div className="relative flex h-12 w-12 items-center justify-center">
                <svg className="h-12 w-12 -rotate-90 transform">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-slate-200"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - (125.6 * summary.progressPercentage) / 100}
                    strokeLinecap="round"
                    className="text-blue-600 transition-all duration-700 ease-out"
                  />
                </svg>
                <span className="absolute text-[11px] font-black text-slate-700">
                  {summary.progressPercentage}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <SummaryPill label="Pass" value={summary.pass} className="border-green-200 bg-green-50 text-green-700" />
          <SummaryPill label="Fail" value={summary.fail} className="border-red-200 bg-red-50 text-red-700" />
          <SummaryPill label="Blocked" value={summary.blocked} className="border-yellow-200 bg-yellow-50 text-yellow-700" />
          <SummaryPill label="N/A" value={summary.na} className="border-slate-200 bg-slate-100 text-slate-600" />
          <SummaryPill label="Pending" value={summary.pending} className="border-blue-200 bg-blue-50 text-blue-700" />
        </div>

        <ApprovalPanel
          checklistByPhases={checklistByPhases}
          taskResults={taskResults}
          summary={summary}
          finalLabStatus={finalLabStatus}
        />

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-slate-500">
            Tip: usa Fail/Blocked solo con observación técnica para que el reporte quede defendible.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEditCommunity}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Settings2 className="h-4 w-4" />
              Editar topología
            </button>
            <button
              type="button"
              onClick={() => setShowTechnicalSheet(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Wrench className="h-4 w-4" />
              Ficha Técnica
            </button>
            <button
              type="button"
              onClick={onExportJson}
              disabled={summary.total === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Exportar JSON
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <button
                type="button"
                onClick={onImportJson}
                className="inline-flex items-center gap-2 text-xs font-black text-slate-600 hover:text-blue-600"
              >
                <Upload className="h-4 w-4" />
                Importar JSON
              </button>
              <label className="flex items-center gap-1.5 border-l border-slate-200 pl-2 text-[11px] font-semibold text-slate-500">
                <input
                  type="checkbox"
                  checked={importStripResults}
                  onChange={event => onToggleImportStripResults(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Solo topología (plantilla)
              </label>
            </div>
            <button
              type="button"
              onClick={onResetChecklist}
              disabled={summary.total === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar checklist
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-12">
        {checklistByPhases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-slate-500">
            Esta comunidad no tiene controladores configurados.
          </div>
        ) : (
          checklistByPhases.map(phase => (
            <PhaseSection
              key={phase.phaseNumber}
              phase={phase}
              taskResults={taskResults}
              getTaskResult={getTaskResult}
              setTaskStatus={setTaskStatus}
              commentBoxes={commentBoxes}
              toggleCommentBox={toggleCommentBox}
              handleCommentChange={handleCommentChange}
              handleEvidenceChange={handleEvidenceChange}
              toggleDeviceAllTasks={toggleDeviceAllTasks}
            />
          ))
        )}
      </div>

      {summary.total > 0 && (
        <section className="mt-12 flex flex-col items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div>
              <h4 className="text-xl font-black tracking-tight text-slate-800">
                Reporte QA disponible
              </h4>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Revisa el estado final, incidencias, evidencia y topología verificada.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onShowReport}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-blue-700 md:w-auto"
          >
            <FileText className="h-5 w-5" />
            Ver Reporte Final
          </button>
        </section>
      )}

      {showTechnicalSheet && (
        <TechnicalSheetModal
          selectedCommunity={selectedCommunity}
          onClose={() => setShowTechnicalSheet(false)}
        />
      )}
    </div>
  );
}
