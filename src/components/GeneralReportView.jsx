import React, { useMemo, useState } from 'react';
import { AlertOctagon, BarChart3, Building, Download, Lock, ShieldAlert } from 'lucide-react';
import { buildGeneralReport } from '../utils/generalReport.js';
import { getFinalStatusClasses } from '../utils/report.js';
import { DEVICE_CATALOG } from '../data/deviceCatalog.jsx';
import { resolveObservationScopeLabel } from '../constants/observationScopes.js';

function getScopeLabels(scope) {
  if (!scope || scope.length === 0) return ['General'];
  return scope.map(id => resolveObservationScopeLabel(id, DEVICE_CATALOG));
}

function StatTile({ label, value, className }) {
  return (
    <div className={`rounded-xl border p-4 text-center shadow-sm ${className || 'border-slate-200 bg-white'}`}>
      <div className="text-2xl font-black text-slate-800">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

export default function GeneralReportView({
  communities,
  taskResults,
  generalObservationsByCommunity,
  deliveryExceptionsByCommunity,
  closedProjectsByCommunity,
  onSelectCommunity,
}) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const report = useMemo(
    () => buildGeneralReport(communities, taskResults, generalObservationsByCommunity, deliveryExceptionsByCommunity, closedProjectsByCommunity),
    [communities, taskResults, generalObservationsByCommunity, deliveryExceptionsByCommunity, closedProjectsByCommunity]
  );

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      const { downloadGeneralReportPdf } = await import('../utils/pdfReport.js');
      downloadGeneralReportPdf({ report });
    } catch (error) {
      console.error('Error generating general report PDF:', error);
      alert('No se pudo generar el PDF. Revisa la consola para más detalle.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (report.communitiesCount === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <BarChart3 className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-800">
          Todavía no hay datos para el reporte general
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Creá o importá al menos una comunidad y ejecutá algunas pruebas para ver acá el resumen agregado.
        </p>
      </section>
    );
  }

  return (
    <div>
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
              <BarChart3 className="h-4 w-4" />
              Reporte General
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-800">
              Resumen de todas las comunidades probadas
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Vista agregada de tu historial local de pruebas — pensada como feedback para el equipo de instalación: qué falla más seguido y dónde.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {isDownloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Comunidades" value={report.communitiesCount} />
          <StatTile label="Pruebas totales" value={report.totals.total} />
          <StatTile label="Fail" value={report.totals.fail} className="border-red-200 bg-red-50" />
          <StatTile label="Blocked" value={report.totals.blocked} className="border-yellow-200 bg-yellow-50" />
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">
          Estado final por comunidad
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(report.statusDistribution).map(([status, count]) => (
            <div key={status} className={`rounded-xl border p-3 text-center ${getFinalStatusClasses(status)}`}>
              <div className="text-xl font-black">{count}</div>
              <div className="text-xs font-bold uppercase">{status}</div>
            </div>
          ))}
        </div>
        {report.deliveredUnderExceptionCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">
            <ShieldAlert className="h-4 w-4" />
            {report.deliveredUnderExceptionCount} {report.deliveredUnderExceptionCount === 1 ? 'comunidad se entregó' : 'comunidades se entregaron'} bajo excepción.
          </div>
        )}
      </section>

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">
          Defectos por tipo de dispositivo/prueba
        </h3>
        {report.deviceBreakdown.length === 0 ? (
          <p className="text-sm italic text-slate-400">Sin datos todavía.</p>
        ) : (
          <div className="space-y-2">
            {report.deviceBreakdown.map(device => (
              <div key={device.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{device.label}</span>
                  <span className="text-xs font-medium text-slate-500">({device.total} pruebas)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-black text-red-700">
                    Fail {device.fail || 0}
                  </span>
                  <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-black text-yellow-700">
                    Blocked {device.blocked || 0}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${
                    device.failRate === 0
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-slate-300 bg-slate-100 text-slate-700'
                  }`}>
                    {device.failRate}% con falla
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">
          Pruebas que más se repiten como Fail/Blocked
        </h3>
        {report.topFailingTests.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
            Sin fallas ni bloqueos registrados todavía.
          </div>
        ) : (
          <ol className="space-y-2">
            {report.topFailingTests.map((item, index) => (
              <li key={item.description} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-black text-white">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">{item.description}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {item.count} {item.count === 1 ? 'vez' : 'veces'}
                    {item.fail > 0 ? ` · ${item.fail} Fail` : ''}
                    {item.blocked > 0 ? ` · ${item.blocked} Blocked` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {report.generalObservations.length > 0 && (
        <section className="mb-8 rounded-xl border border-purple-200 bg-purple-50/40 p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-purple-800">
            <AlertOctagon className="h-4 w-4" />
            Observaciones Generales consolidadas
          </h3>
          <div className="space-y-2">
            {report.generalObservations.map((observation, index) => (
              <article key={`${observation.id}-${index}`} className="rounded-lg border border-purple-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wide text-purple-600">{observation.communityName}</p>
                  <div className="flex flex-wrap gap-1">
                    {getScopeLabels(observation.scope).map(label => (
                      <span key={label} className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-700">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <h5 className="mt-1 text-sm font-bold text-slate-800">{observation.title}</h5>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{observation.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">
          Detalle por comunidad
        </h3>
        <div className="space-y-2">
          {report.communitySummaries.map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelectCommunity(entry.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100"
            >
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-800">{entry.name}</span>
                {entry.deliveredUnderException && (
                  <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />
                )}
                {entry.isClosed && (
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${getFinalStatusClasses(entry.finalLabStatus)}`}>
                  {entry.finalLabStatus}
                </span>
                {entry.deliveredUnderException && (
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-700">
                    Entregado bajo excepción
                  </span>
                )}
                <span className="text-xs font-medium text-slate-500">
                  {entry.summary.completed}/{entry.summary.total}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
