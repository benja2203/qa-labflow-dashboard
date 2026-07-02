import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Download,
  MapPin,
  Network,
  Server,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { DEVICE_CATALOG } from '../data/deviceCatalog.jsx';
import { TEST_STATUS } from '../constants/testStatus.js';
import {
  getApprovalSummaryText,
  getFinalStatusClasses,
  getFullReportTasks,
  getReportIssues,
  getTechnicalDeviceReport,
  hasChecklistFailuresWithoutComment,
} from '../utils/report.js';

function MetricCard({ value, label, className = 'text-blue-600' }) {
  return (
    <div className="pdf-avoid-break rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className={`mb-1 text-3xl font-black ${className}`}>{value}</div>
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
    </div>
  );
}

function getStatusConfig(status) {
  return TEST_STATUS[status] || TEST_STATUS.pending;
}

function formatUpdatedAt(value) {
  if (!value) return 'Sin actualización';

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

function EmptyField({ label }) {
  return <span className="text-slate-400">Sin {label}</span>;
}

function StatusBadge({ status }) {
  const statusConfig = getStatusConfig(status);

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${statusConfig.badge}`}>
      {statusConfig.shortLabel}
    </span>
  );
}

function getPeripheralInstanceLabels(peripheral) {
  const catalogName = DEVICE_CATALOG[peripheral.type]?.name || peripheral.type;
  const qty = Number(peripheral.qty) || peripheral.instances?.length || 1;
  const instances = Array.isArray(peripheral.instances) ? peripheral.instances : [];

  if (!instances.length) return [`${qty}x ${catalogName}`];

  return instances.slice(0, qty).map((instance, index) => {
    const label = instance.label?.trim() || `${catalogName} #${index + 1}`;
    return `${catalogName} #${index + 1}: ${label}`;
  });
}

function getModuleNames(selectedCommunity) {
  const moduleIds = Array.isArray(selectedCommunity.modules) ? selectedCommunity.modules : [];

  return moduleIds
    .map(id => DEVICE_CATALOG[id]?.name)
    .filter(Boolean);
}

function getDeviceCoverageRows(fullChecklistResults) {
  return fullChecklistResults.flatMap(phase => (
    phase.devices.map(device => {
      const counts = {
        total: device.tasks.length,
        pass: 0,
        fail: 0,
        blocked: 0,
        na: 0,
        pending: 0,
      };

      device.tasks.forEach(task => {
        if (counts[task.status] !== undefined) {
          counts[task.status] += 1;
        } else {
          counts.pending += 1;
        }
      });

      return {
        phaseName: phase.phaseName,
        deviceName: device.deviceName,
        counts,
      };
    })
  ));
}

export default function ReportModal({
  selectedCommunity,
  checklistByPhases,
  taskResults,
  summary,
  finalLabStatus,
  onClose,
}) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [reportMode, setReportMode] = useState('compact');

  const issues = getReportIssues(checklistByPhases, taskResults);
  const fullChecklistResults = getFullReportTasks(checklistByPhases, taskResults);
  const coverageRows = getDeviceCoverageRows(fullChecklistResults);
  const technicalReport = getTechnicalDeviceReport(selectedCommunity);
  const hasInvalidFailures = hasChecklistFailuresWithoutComment(checklistByPhases, taskResults);
  const generatedAt = new Date();
  const enabledModules = getModuleNames(selectedCommunity);
  const peripheralsCount = selectedCommunity.nodes?.reduce((acc, node) => {
    return acc + (node.peripherals || []).reduce((peripheralAcc, peripheral) => peripheralAcc + Number(peripheral.qty || 0), 0);
  }, 0) || 0;

  const isCompactReport = reportMode === 'compact';

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;

    setIsDownloadingPdf(true);

    try {
      const { downloadStructuredPdfReport } = await import('../utils/pdfReport.js');

      downloadStructuredPdfReport({
        selectedCommunity,
        checklistByPhases,
        taskResults,
        summary,
        finalLabStatus,
        reportMode,
      });
    } catch (error) {
      console.error('Error generating PDF report:', error);
      alert('No se pudo generar el PDF. Revisa la consola para más detalle.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm md:p-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto w-[980px] max-w-full bg-white shadow-2xl">
          <div className="pdf-report bg-white">
            <header className="pdf-avoid-break bg-slate-800 p-6 text-white md:p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-blue-300">
                    <Activity className="h-4 w-4" />
                    QA LabFlow - Reporte de Validación
                  </div>
                  <h2 className="text-3xl font-black">{selectedCommunity.name}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-medium text-slate-300">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {generatedAt.toLocaleDateString('es-CL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      {summary.completed} de {summary.total} pruebas evaluadas
                    </span>
                    <span>
                      Tipo: {isCompactReport ? 'Compacto' : 'Completo'}
                    </span>
                  </div>
                </div>

                <div className={`hidden rounded-xl border px-4 py-3 text-right md:block ${getFinalStatusClasses(finalLabStatus)}`}>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider opacity-80">
                    Estado final
                  </div>
                  <div className="text-xl font-black">{finalLabStatus}</div>
                </div>
              </div>
            </header>

            <main className="bg-slate-50 p-6 md:p-8">
              {hasInvalidFailures && (
                <div className="pdf-avoid-break mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-semibold text-yellow-800">
                  Hay pruebas en Fail o Blocked sin observación técnica. El reporte puede revisarse, pero no debería cerrarse hasta completar esos comentarios.
                </div>
              )}

              <section className="pdf-avoid-break mb-8 space-y-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                  <strong>Objetivo del reporte:</strong> dejar trazabilidad de qué se validó, qué falló y qué evidencia quedó registrada. En modo compacto se evita listar todas las pruebas una por una; se muestra cobertura por equipo y solo se detallan fallas, bloqueos, observaciones o evidencias.
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  <strong>Alcance de validación QA:</strong> se ejecutaron las pruebas correspondientes según la topología configurada para la comunidad, considerando controlador, periféricos asociados, reglas de acceso activas y módulos habilitados.

                  <br /><br />

                  Además de los casos definidos en el checklist, se realizó una validación exploratoria complementaria sobre los flujos principales de acceso, revisando el comportamiento general del sistema, la apertura del relé correspondiente, el registro de eventos y la consistencia entre dispositivo, aplicación y dashboard.
                </div>
              </section>

              <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                <MetricCard value={selectedCommunity.nodes?.length || 0} label="Controladores" />
                <MetricCard value={peripheralsCount} label="Periféricos" />
                <MetricCard value={summary.total} label="Puntos de Control" />
                <MetricCard value={issues.length} label="Observaciones" className="text-red-500" />
              </section>

              <section className="pdf-avoid-break mb-8">
                <h3 className="mb-4 flex items-center gap-2 border-b-2 border-slate-200 pb-2 text-lg font-black text-slate-800">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  Módulo de Aprobación
                </h3>
                <div className={`rounded-xl border p-4 text-sm font-semibold leading-6 ${getFinalStatusClasses(finalLabStatus)}`}>
                  {getApprovalSummaryText(summary, finalLabStatus)}
                </div>
              </section>

              <section className="pdf-avoid-break mb-8">
                <h3 className="mb-4 flex items-center gap-2 border-b-2 border-slate-200 pb-2 text-lg font-black text-slate-800">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Resumen de Estados
                </h3>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {Object.entries({
                    pass: summary.pass,
                    fail: summary.fail,
                    blocked: summary.blocked,
                    na: summary.na,
                    pending: summary.pending,
                  }).map(([status, value]) => (
                    <div key={status} className={`pdf-avoid-break rounded-xl border p-3 text-center ${getStatusConfig(status).badge}`}>
                      <div className="text-2xl font-black">{value}</div>
                      <div className="text-xs font-bold uppercase">{getStatusConfig(status).shortLabel}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-8">
                <h3 className="pdf-avoid-break mb-4 flex items-center gap-2 border-b-2 border-slate-200 pb-2 text-lg font-black text-slate-800">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Observaciones, Fallas y Evidencia Relevante
                </h3>

                {issues.length === 0 ? (
                  <div className="pdf-avoid-break flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
                    <CheckCircle2 className="h-5 w-5" />
                    No se registraron incidencias ni observaciones durante las pruebas.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issues.map((issue, index) => (
                      <article key={`${issue.deviceName}-${issue.taskDescription}-${index}`} className="pdf-avoid-break rounded-r-xl border-l-4 border-red-500 bg-white p-4 shadow-sm">
                        <div className="mb-1 text-xs font-bold uppercase tracking-wider text-red-800">
                          {issue.phaseName} / {issue.deviceName}
                        </div>
                        <div className="mb-2 text-sm font-medium text-slate-700">
                          Prueba: <span className="font-normal italic">{issue.taskDescription}</span>
                        </div>
                        <div className="mb-3">
                          <StatusBadge status={issue.status} />
                        </div>

                        {issue.comment && (
                          <div className="mb-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-slate-800">
                            <strong>Observación:</strong> {issue.comment}
                          </div>
                        )}

                        {issue.evidence && (
                          <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                            <strong>Evidencia:</strong> {issue.evidence}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {isCompactReport ? (
                <section className="mb-8">
                  <h3 className="pdf-avoid-break mb-4 flex items-center gap-2 border-b-2 border-slate-200 pb-2 text-lg font-black text-slate-800">
                    <ClipboardList className="h-5 w-5 text-blue-500" />
                    Cobertura por Equipo Evaluado
                  </h3>

                  <div className="space-y-3">
                    {coverageRows.map(row => (
                      <article key={`${row.phaseName}-${row.deviceName}`} className="pdf-avoid-break rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {row.phaseName}
                        </div>
                        <h4 className="mt-1 text-sm font-black text-slate-800">{row.deviceName}</h4>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge status="pass" />
                          <span className="text-xs font-bold text-slate-600">{row.counts.pass}</span>
                          <StatusBadge status="fail" />
                          <span className="text-xs font-bold text-slate-600">{row.counts.fail}</span>
                          <StatusBadge status="blocked" />
                          <span className="text-xs font-bold text-slate-600">{row.counts.blocked}</span>
                          <StatusBadge status="na" />
                          <span className="text-xs font-bold text-slate-600">{row.counts.na}</span>
                          <StatusBadge status="pending" />
                          <span className="text-xs font-bold text-slate-600">{row.counts.pending}</span>
                          <span className="ml-auto text-xs font-black text-slate-500">Total: {row.counts.total}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="mb-8">
                  <h3 className="pdf-avoid-break mb-4 flex items-center gap-2 border-b-2 border-slate-200 pb-2 text-lg font-black text-slate-800">
                    <ClipboardList className="h-5 w-5 text-blue-500" />
                    Detalle Completo de Pruebas Ejecutadas
                  </h3>

                  <div className="space-y-6">
                    {fullChecklistResults.map(phase => (
                      <div key={phase.phaseNumber} className="pdf-phase-section rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="pdf-avoid-break mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-700">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                            {phase.phaseNumber}
                          </span>
                          <h4>{phase.phaseName}</h4>
                        </div>

                        <div className="space-y-5">
                          {phase.devices.map(device => (
                            <article key={`${phase.phaseNumber}-${device.deviceName}`} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                              <div className="pdf-avoid-break mb-3">
                                <h5 className="text-sm font-black text-slate-800">
                                  {device.deviceName}
                                </h5>
                              </div>

                              <div className="space-y-2">
                                {device.tasks.map(task => (
                                  <div key={task.id} className="pdf-avoid-break rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                      <div className="flex-1">
                                        <div className="mb-1 text-[11px] font-black uppercase text-slate-400">
                                          Prueba #{task.order}
                                        </div>
                                        <div className="font-semibold leading-5 text-slate-800">
                                          {task.description}
                                        </div>
                                      </div>
                                      <StatusBadge status={task.status} />
                                    </div>

                                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                                        <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                          Observación
                                        </div>
                                        <div className="whitespace-pre-wrap text-xs leading-5 text-slate-700">
                                          {task.comment?.trim() ? task.comment : <EmptyField label="observación" />}
                                        </div>
                                      </div>

                                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                                        <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                          Evidencia
                                        </div>
                                        <div className="whitespace-pre-wrap text-xs leading-5 text-slate-700">
                                          {task.evidence?.trim() ? task.evidence : <EmptyField label="evidencia" />}
                                        </div>
                                      </div>

                                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                                        <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                          Última actualización
                                        </div>
                                        <div className="text-xs leading-5 text-slate-700">
                                          {formatUpdatedAt(task.updatedAt)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="pdf-avoid-break mb-4 flex items-center gap-2 border-b-2 border-slate-200 pb-2 text-lg font-black text-slate-800">
                  <Network className="h-5 w-5 text-blue-500" />
                  Topología, Módulos y Reglas Verificadas
                </h3>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="pdf-avoid-break rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
                      Equipos Configurados
                    </h4>
                    <ul className="space-y-3">
                      {selectedCommunity.nodes?.map(node => (
                        <li key={node.id} className="text-sm">
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                            <Server className="h-4 w-4 text-blue-600" />
                            {node.label}
                          </div>
                          {node.peripherals?.length > 0 && (
                            <ul className="mt-1 space-y-1 pl-6">
                              {node.peripherals.flatMap(peripheral => (
                                getPeripheralInstanceLabels(peripheral).map(label => (
                                  <li key={`${peripheral.type}-${label}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                    <ArrowRight className="h-3 w-3 text-slate-300" />
                                    {label}
                                  </li>
                                ))
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pdf-avoid-break rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
                      Módulos y Lógica Activa
                    </h4>
                    <ul className="space-y-3">
                      <li className="text-sm font-medium text-slate-700">
                        <span className="font-bold">Módulos opcionales:</span>{' '}
                        {enabledModules.length ? enabledModules.join(' + ') : 'No requeridos'}
                      </li>

                      {selectedCommunity.rules?.antipassback ? (
                        <li className="flex items-start gap-2 text-sm font-bold text-slate-800">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                          Anti-Passback habilitado
                        </li>
                      ) : (
                        <li className="flex items-start gap-2 text-sm font-medium text-slate-400">
                          <Circle className="h-5 w-5 shrink-0" />
                          Anti-Passback no requerido
                        </li>
                      )}

                      {selectedCommunity.rules?.multivalidation ? (
                        <li className="flex items-start gap-2 text-sm font-bold text-slate-800">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                          <div>
                            Multivalidación habilitada
                            <div className="mt-0.5 text-xs font-medium text-slate-500">
                              Factores: {selectedCommunity.rules.multiFactors
                                ?.map(id => DEVICE_CATALOG[id]?.name)
                                .filter(Boolean)
                                .join(' + ')}
                            </div>
                          </div>
                        </li>
                      ) : (
                        <li className="flex items-start gap-2 text-sm font-medium text-slate-400">
                          <Circle className="h-5 w-5 shrink-0" />
                          Multivalidación no requerida
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="pdf-avoid-break mb-4 flex items-center gap-2 border-b-2 border-slate-200 pb-2 text-lg font-black text-slate-800">
                  <Wrench className="h-5 w-5 text-blue-500" />
                  Ficha Técnica: Puertas, Relés, Puertos e IP
                </h3>

                {(selectedCommunity.technicianName || selectedCommunity.installerName) && (
                  <div className="pdf-avoid-break mb-4 flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-600">
                    {selectedCommunity.technicianName && (
                      <span>Configurado por: <strong className="text-slate-800">{selectedCommunity.technicianName}</strong></span>
                    )}
                    {selectedCommunity.installerName && (
                      <span>Instalado por: <strong className="text-slate-800">{selectedCommunity.installerName}</strong></span>
                    )}
                  </div>
                )}

                <div className="space-y-5">
                  {technicalReport.controllers.map(controller => (
                    <div key={controller.nodeId} className="pdf-avoid-break">
                      <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
                        <Server className="h-4 w-4 text-slate-500" />
                        {controller.nodeLabel}
                      </div>

                      {controller.doors.length === 0 ? (
                        <p className="pl-6 text-xs italic text-slate-400">Sin puertas registradas en este controlador.</p>
                      ) : (
                        <div className="space-y-2">
                          {controller.doors.map(door => (
                            <article key={door.id} className="pdf-avoid-break rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-blue-600" />
                                  <h5 className="text-sm font-black text-slate-800">{door.name}</h5>
                                  {door.zone && (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                                      {door.zone}
                                    </span>
                                  )}
                                </div>
                                {door.type && (
                                  <span className="text-[11px] font-medium text-slate-500">Tipo: <strong className="text-slate-700">{door.type}</strong></span>
                                )}
                              </div>

                              <div className="mt-3 space-y-1.5">
                                {door.devices.length === 0 ? (
                                  <p className="text-xs italic text-slate-400">Ningún dispositivo conectado a esta puerta todavía.</p>
                                ) : (
                                  door.devices.map((device, index) => (
                                    <div key={`${door.id}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span>
                                          <span className="font-bold text-slate-800">{device.typeName}</span>{' '}
                                          <span className="text-slate-600">{device.label}</span>{' '}
                                          {device.directionLabel && (
                                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-600">
                                              {device.directionLabel}
                                            </span>
                                          )}
                                        </span>
                                        <span className="flex items-center gap-1.5 font-bold text-amber-700">
                                          <Zap className="h-3.5 w-3.5 text-amber-500" />
                                          {device.relayLabel || 'Sin relé configurado'}
                                          {device.relayPin && <span className="text-slate-400">(pin {device.relayPin})</span>}
                                          {device.actionSeconds && <span className="text-slate-500">· {device.actionSeconds}s</span>}
                                        </span>
                                      </div>
                                      <div className="mt-1 text-slate-500">
                                        {device.portLabel && <>Puerto: {device.portLabel} </>}
                                        {device.ip && <>IP: {device.ip}</>}
                                        {!device.portLabel && !device.ip && <EmptyField label="puerto/IP" />}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {technicalReport.unassignedDevices.length > 0 && (
                  <div className="pdf-avoid-break mt-5">
                    <h4 className="mb-2 text-sm font-black uppercase tracking-wide text-amber-600">
                      Dispositivos sin puerta asignada
                    </h4>
                    <div className="space-y-2">
                      {technicalReport.unassignedDevices.map((device, index) => (
                        <div key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              <span className="font-bold text-slate-800">{device.typeName}</span>{' '}
                              <span className="text-slate-600">{device.label}</span>{' '}
                              <span className="text-slate-400">[{device.controllerLabel}]</span>
                            </span>
                            <span className="flex items-center gap-1.5 font-bold text-amber-700">
                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                              {device.relayLabel || 'Sin relé configurado'}
                              {device.actionSeconds && <span className="text-slate-500">· {device.actionSeconds}s</span>}
                            </span>
                          </div>
                          <div className="mt-1 text-slate-500">
                            {device.portLabel && <>Puerto: {device.portLabel} </>}
                            {device.ip && <>IP: {device.ip}</>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </main>
          </div>
        </div>

        <footer className="no-print sticky bottom-4 mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl md:flex-row md:items-center md:justify-between md:p-5">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
            Cerrar
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-slate-400">
                Tipo de PDF
              </label>
              <select
                value={reportMode}
                onChange={event => setReportMode(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-52"
              >
                <option value="compact">Compacto recomendado</option>
                <option value="full">Completo con todas las pruebas</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-5 w-5" />
              {isDownloadingPdf ? 'Generando PDF...' : `Descargar PDF ${isCompactReport ? 'compacto' : 'completo'}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
