import React, { useState } from 'react';
import { ArrowDownToLine, ArrowRight, Download, MapPin, Server, Wrench, X, Zap } from 'lucide-react';
import { getTechnicalDeviceReport } from '../utils/report.js';

function DeviceRow({ device }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          <span className="font-bold text-slate-800">{device.typeName}</span>
          <span className="text-slate-500">{device.label}</span>
          {device.directionLabel && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-600">
              {device.directionLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 font-bold text-amber-700">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          {device.relayLabel || 'Sin relé configurado'}
          {device.relayPin && <span className="text-slate-400">(pin {device.relayPin})</span>}
          {device.actionSeconds && <span className="text-slate-500">· {device.actionSeconds}s</span>}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3 text-slate-500">
        {device.portLabel && <span><span className="font-bold text-slate-700">Puerto:</span> {device.portLabel}</span>}
        {device.ip && <span><span className="font-bold text-slate-700">IP:</span> {device.ip}</span>}
        {!device.portLabel && !device.ip && <span className="italic text-slate-400">Sin puerto/IP registrado</span>}
      </div>
    </div>
  );
}

function DoorCard({ door }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <h5 className="text-sm font-black text-slate-800">{door.name}</h5>
          {door.zone && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {door.zone}
            </span>
          )}
        </div>
        {door.type && (
          <span className="text-[11px] font-medium text-slate-500">Tipo: <strong className="text-slate-700">{door.type}</strong></span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {door.devices.length === 0 ? (
          <p className="text-xs italic text-slate-400">Ningún dispositivo conectado a esta puerta todavía.</p>
        ) : (
          door.devices.map((device, index) => <DeviceRow key={`${door.id}-${index}`} device={device} />)
        )}
      </div>
    </article>
  );
}

export default function TechnicalSheetModal({ selectedCommunity, onClose }) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const { controllers, unassignedDevices } = getTechnicalDeviceReport(selectedCommunity);

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;

    setIsDownloadingPdf(true);

    try {
      const { downloadTechnicalSheetPdf } = await import('../utils/pdfReport.js');
      downloadTechnicalSheetPdf({ selectedCommunity });
    } catch (error) {
      console.error('Error generating technical sheet PDF:', error);
      alert('No se pudo generar el PDF de la ficha técnica. Revisa la consola para más detalle.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm md:p-8">
      <div className="mx-auto w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 rounded-t-2xl border-b border-slate-100 bg-slate-800 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Ficha Técnica</h2>
              <p className="text-xs font-medium text-slate-300">{selectedCommunity.name} · mapa de puertas, relés, puertos e IPs</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        {(selectedCommunity.technicianName || selectedCommunity.installerName) && (
          <div className="flex flex-wrap gap-4 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs font-semibold text-slate-600">
            {selectedCommunity.technicianName && (
              <span>Configurado por: <strong className="text-slate-800">{selectedCommunity.technicianName}</strong></span>
            )}
            {selectedCommunity.installerName && (
              <span>Instalado por: <strong className="text-slate-800">{selectedCommunity.installerName}</strong></span>
            )}
          </div>
        )}

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {controllers.length === 0 ? (
            <p className="text-sm text-slate-500">Esta comunidad no tiene controladores configurados.</p>
          ) : (
            <div className="space-y-6">
              {controllers.map(controller => (
                <div key={controller.nodeId}>
                  <div className="mb-2 flex items-center gap-2">
                    <Server className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">
                      {controller.nodeLabel}
                    </h3>
                  </div>

                  {controller.doors.length === 0 ? (
                    <p className="pl-6 text-xs italic text-slate-400">Sin puertas registradas en este controlador.</p>
                  ) : (
                    <div className="space-y-3 pl-1">
                      {controller.doors.map(door => <DoorCard key={door.id} door={door} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {unassignedDevices.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-amber-600">
                Dispositivos sin puerta asignada
              </h3>
              <div className="space-y-2">
                {unassignedDevices.map((device, index) => (
                  <DeviceRow key={index} device={{ ...device, typeName: `${device.typeName} [${device.controllerLabel}]` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100">
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloadingPdf ? <ArrowDownToLine className="h-4 w-4 animate-bounce" /> : <Download className="h-4 w-4" />}
            {isDownloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
        </footer>
      </div>
    </div>
  );
}
