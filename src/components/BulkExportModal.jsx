import React, { useState } from 'react';
import { Building, Download, Loader2, Lock, X } from 'lucide-react';

export default function BulkExportModal({ communities, closedProjects, onExport, onClose }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(communities.map(c => c.id)));
  const [isExporting, setIsExporting] = useState(false);

  const toggleId = id => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(prev => (
      prev.size === communities.length ? new Set() : new Set(communities.map(c => c.id))
    ));
  };

  const handleExport = async () => {
    if (selectedIds.size === 0 || isExporting) return;
    setIsExporting(true);
    await onExport([...selectedIds]);
    setIsExporting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-base font-black text-slate-800">Exportar varias comunidades</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-3 text-sm leading-6 text-slate-600">
            Descarga un JSON completo por cada comunidad marcada — topología, resultados de
            pruebas, observaciones y excepción de entrega. Si está cerrada, exporta la foto
            congelada tal como quedó.
          </p>

          {communities.length === 0 ? (
            <p className="text-sm italic text-slate-400">No hay comunidades para exportar.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleAll}
                className="mb-2 text-xs font-black text-blue-600 hover:underline"
              >
                {selectedIds.size === communities.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>

              <div className="space-y-1.5">
                {communities.map(community => {
                  const isClosed = Boolean(closedProjects?.[community.id]?.closed);
                  const isChecked = selectedIds.has(community.id);

                  return (
                    <label
                      key={community.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        isChecked ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleId(community.id)}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Building className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate text-sm font-medium text-slate-700">{community.name}</span>
                      {isClosed && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                          <Lock className="h-3 w-3" />
                          Cerrado
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-black text-slate-500 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedIds.size === 0 || isExporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {isExporting ? 'Exportando...' : `Exportar ${selectedIds.size || ''} proyecto${selectedIds.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
