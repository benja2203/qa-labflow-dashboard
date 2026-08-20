import React, { useMemo, useState } from 'react';
import { AlertOctagon, BarChart3, Building, Download, Lock, ShieldAlert, Wrench } from 'lucide-react';
import { buildGeneralReport } from '../utils/generalReport.js';
import { getFinalStatusClasses } from '../utils/report.js';

const STATUS_BAR_COLORS = {
  APTO: 'bg-green-500',
  'NO APTO': 'bg-red-500',
  BLOQUEADO: 'bg-yellow-500',
  'EN PROGRESO': 'bg-blue-500',
};

const SEVERITY_RANK = { 'NO APTO': 0, BLOQUEADO: 1, 'EN PROGRESO': 2, APTO: 3 };

const SEVERITY_BORDER_CLASSES = {
  'NO APTO': 'border-l-4 border-l-red-500',
  BLOQUEADO: 'border-l-4 border-l-yellow-500',
  'EN PROGRESO': 'border-l-4 border-l-blue-500',
  APTO: 'border-l-4 border-l-green-500',
};

function StatTile({ label, value, className }) {
  return (
    <div className={`rounded-xl border p-4 text-center shadow-sm ${className || 'border-slate-200 bg-white'}`}>
      <div className="text-2xl font-black text-slate-800">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function HorizontalBarRow({ label, value, maxValue, barClassName }) {
  const widthPercentage = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,150px)_1fr_40px] items-center gap-3">
      <span className="truncate text-right text-sm font-bold text-slate-700">{label}</span>
      <div className="h-5 overflow-hidden rounded-md bg-slate-100">
        <div className={`h-full rounded-md ${barClassName}`} style={{ width: `${widthPercentage}%` }} />
      </div>
      <span className="text-right text-xs font-black text-slate-600">{value}</span>
    </div>
  );
}

function buildHeadlineSentence(report) {
  const { communitiesCount, noAptoCount, noAptoWithProcessObservationCount } = report;

  if (noAptoCount === 0) {
    return (
      <>
        De <strong className="text-green-700">{communitiesCount}</strong> {communitiesCount === 1 ? 'proyecto probado' : 'proyectos probados'}, ninguno quedó <strong>NO APTO</strong>.
      </>
    );
  }

  return (
    <>
      De <strong className="text-slate-800">{communitiesCount}</strong> {communitiesCount === 1 ? 'proyecto probado' : 'proyectos probados'}, <strong className="text-red-700">{noAptoCount} {noAptoCount === 1 ? 'quedó' : 'quedaron'} NO APTO</strong>
      {noAptoWithProcessObservationCount > 0 && (
        <> — y <strong>{noAptoWithProcessObservationCount} de {noAptoCount}</strong> tienen observaciones de <strong>instalación no lista</strong> registradas, no solo fallas técnicas.</>
      )}
      {noAptoWithProcessObservationCount === 0 && <>.</>}
    </>
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

  const evaluatedStatusEntries = Object.entries(report.statusDistribution).filter(([, count]) => count > 0);
  const evaluatedCommunitiesTotal = evaluatedStatusEntries.reduce((acc, [, count]) => acc + count, 0);

  const defectiveDevices = report.deviceBreakdown.filter(device => (device.fail || 0) + (device.blocked || 0) > 0);
  const maxDeviceDefects = defectiveDevices.reduce((max, device) => Math.max(max, (device.fail || 0) + (device.blocked || 0)), 0);

  const maxInstallerIncidents = report.installerBreakdown.reduce((max, entry) => Math.max(max, entry.incidentCount), 0);

  const sortedCommunitySummaries = [...report.communitySummaries].sort(
    (a, b) => SEVERITY_RANK[a.finalLabStatus] - SEVERITY_RANK[b.finalLabStatus]
  );

  return (
    <div>
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
              Vista agregada pensada para detectar problemas recurrentes en instalación y en el sistema.
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

        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-[15px] font-semibold leading-6 text-slate-800">
          {buildHeadlineSentence(report)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Proyectos" value={report.communitiesCount} />
          <StatTile label="Aprobación" value={`${report.approvalRate}%`} className="border-green-200 bg-green-50" />
          <StatTile label="Bajo excepción" value={report.deliveredUnderExceptionCount} className="border-orange-200 bg-orange-50" />
          <StatTile label="Obs. instalación" value={report.installationNotReadyCount} className="border-purple-200 bg-purple-50" />
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">
          Instalación no lista vs. falla técnica real
        </h3>
        <p className="mb-4 mt-1 text-xs text-slate-500">
          Separa lo que retrasa a QA por causas ajenas, de lo que realmente falló en el sistema.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-2 text-purple-700">
              <Wrench className="h-4 w-4" />
              <span className="text-2xl font-black">{report.installationNotReadyCount}</span>
            </div>
            <p className="mt-1 text-sm font-bold text-purple-800">Observaciones de instalación</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Equipos sin energizar, sin configurar o faltantes al momento de probar — categoría "Proceso/Documentación".
            </p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertOctagon className="h-4 w-4" />
              <span className="text-2xl font-black">{report.technicalFailureCount}</span>
            </div>
            <p className="mt-1 text-sm font-bold text-red-800">Fallas técnicas confirmadas</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Pruebas en Fail o Blocked sobre equipos que sí estaban instalados y configurados correctamente.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">
          Estado final por proyecto
        </h3>
        <div className="flex h-8 overflow-hidden rounded-lg border border-slate-200">
          {evaluatedStatusEntries.map(([status, count]) => (
            <div
              key={status}
              className={`flex items-center justify-center text-[11px] font-black text-white ${STATUS_BAR_COLORS[status]}`}
              style={{ width: `${(count / evaluatedCommunitiesTotal) * 100}%` }}
              title={`${count} ${status}`}
            >
              {count} {status}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {Object.keys(STATUS_BAR_COLORS).map(status => (
            <span key={status} className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_BAR_COLORS[status]}`} />
              {status}
            </span>
          ))}
        </div>
      </section>

      {report.installerBreakdown.length > 0 && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">
            Incidencias por instalador
          </h3>
          <div className="space-y-2.5">
            {report.installerBreakdown.map(entry => (
              <HorizontalBarRow
                key={entry.name}
                label={entry.name}
                value={entry.incidentCount}
                maxValue={maxInstallerIncidents}
                barClassName="bg-red-500"
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">
          Defectos por tipo de dispositivo
        </h3>
        {defectiveDevices.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
            Sin defectos registrados por tipo de dispositivo todavía.
          </div>
        ) : (
          <div className="space-y-2.5">
            {defectiveDevices.map(device => (
              <HorizontalBarRow
                key={device.id}
                label={device.label}
                value={(device.fail || 0) + (device.blocked || 0)}
                maxValue={maxDeviceDefects}
                barClassName="bg-red-500"
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">
          Detalle por proyecto — peor estado primero
        </h3>
        <div className="space-y-2">
          {sortedCommunitySummaries.map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelectCommunity(entry.id)}
              className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100 ${SEVERITY_BORDER_CLASSES[entry.finalLabStatus]}`}
            >
              <div>
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
                <div className="ml-6 text-xs font-medium text-slate-500">
                  {entry.installerName ? `${entry.installerName} · ` : ''}{entry.summary.completed}/{entry.summary.total} pruebas
                </div>
              </div>
              <div className="flex items-center gap-2">
                {entry.deliveredUnderException && (
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-700">
                    Entregado bajo excepción
                  </span>
                )}
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${getFinalStatusClasses(entry.finalLabStatus)}`}>
                  {entry.finalLabStatus}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
