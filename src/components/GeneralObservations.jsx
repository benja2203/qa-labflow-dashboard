import React, { useState } from 'react';
import { AlertOctagon, Check, CheckCircle2, Circle, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { DEVICE_CATALOG } from '../data/deviceCatalog.jsx';
import { resolveObservationScopeLabel } from '../constants/observationScopes.js';

function getScopeLabels(scope) {
  if (!scope || scope.length === 0) return ['General'];
  return scope.map(id => resolveObservationScopeLabel(id, DEVICE_CATALOG));
}

function ScopeChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-black transition-all ${
        active
          ? 'border-purple-300 bg-purple-100 text-purple-700'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function ScopeBadge({ children }) {
  return (
    <span className="inline-block rounded-full border border-purple-200 bg-purple-100 px-2.5 py-0.5 text-[11px] font-black text-purple-700">
      {children}
    </span>
  );
}

function ResolvedToggle({ resolved, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={resolved ? 'Marcar como pendiente' : 'Marcar como resuelta'}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black transition-colors ${
        resolved
          ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
      }`}
    >
      {resolved ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      {resolved ? 'Resuelta' : 'Pendiente'}
    </button>
  );
}

function ObservationForm({ deviceTypeOptions, initialValues, onCancel, onSubmit }) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [scope, setScope] = useState(initialValues?.scope || []);

  const toggleScope = typeId => {
    setScope(prev => (prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]));
  };

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) return;
    onSubmit({ title: title.trim(), description: description.trim(), scope });
  };

  return (
    <div className="space-y-3 rounded-lg border border-purple-200 bg-white p-3 shadow-inner">
      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
          Título
        </label>
        <input
          type="text"
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Ej: Reconocimiento facial con baja precisión a contraluz"
          className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
          Alcance (a qué módulos/dispositivos aplica) — vacío = General
        </label>
        <div className="flex flex-wrap gap-1.5">
          {deviceTypeOptions.map(deviceType => (
            <ScopeChip
              key={deviceType.id}
              active={scope.includes(deviceType.id)}
              onClick={() => toggleScope(deviceType.id)}
            >
              {deviceType.label}
            </ScopeChip>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
          Descripción / detalle para ticket
        </label>
        <textarea
          value={description}
          onChange={event => setDescription(event.target.value)}
          placeholder="Describe el problema o mejora de forma general. Este texto está pensado para copiarlo directo a un ticket."
          className="h-24 w-full resize-none rounded-md border border-slate-200 bg-white p-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-black text-slate-500 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim() || !description.trim()}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar observación
        </button>
      </div>
    </div>
  );
}

function ObservationCard({ observation, onEdit, onDelete, onToggleResolved }) {
  const [copied, setCopied] = useState(false);
  const scopeLabels = getScopeLabels(observation.scope);

  const handleCopy = async () => {
    const text = [
      `[Observación General] ${observation.title}`,
      `Alcance: ${scopeLabels.join(', ')}`,
      `Estado: ${observation.resolved ? 'Resuelta' : 'Pendiente'}`,
      '',
      observation.description,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert('No se pudo copiar automáticamente. Copia el texto manualmente.');
    }
  };

  return (
    <article className="rounded-lg border border-purple-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <ResolvedToggle resolved={Boolean(observation.resolved)} onClick={onToggleResolved} />
            {scopeLabels.map(label => (
              <ScopeBadge key={label}>{label}</ScopeBadge>
            ))}
          </div>
          <h5 className="text-sm font-bold leading-tight text-slate-800">{observation.title}</h5>
          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-slate-600">
            {observation.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            title="Copiar para ticket"
            className={`rounded-md p-1.5 transition-colors ${
              copied ? 'bg-green-100 text-green-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Editar"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function GeneralObservations({
  observations,
  deviceTypeOptions,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  return (
    <section className="mb-6 rounded-xl border border-purple-200 bg-purple-50/40 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100 p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600">
            <AlertOctagon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">Observaciones Generales</h3>
            <p className="text-xs font-medium text-slate-500">
              Notas transversales (no atadas a una prueba puntual), listas para copiar a un ticket de mejora.
            </p>
          </div>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        )}
      </header>

      <div className="space-y-3 p-4">
        {observations.length === 0 && !isAdding && (
          <p className="text-xs font-medium italic text-slate-500">
            Todavía no hay observaciones generales para esta comunidad.
          </p>
        )}

        {observations.map(observation => (
          editingId === observation.id ? (
            <ObservationForm
              key={observation.id}
              deviceTypeOptions={deviceTypeOptions}
              initialValues={observation}
              onCancel={() => setEditingId(null)}
              onSubmit={values => {
                onUpdate(observation.id, values);
                setEditingId(null);
              }}
            />
          ) : (
            <ObservationCard
              key={observation.id}
              observation={observation}
              onEdit={() => {
                setEditingId(observation.id);
                setIsAdding(false);
              }}
              onDelete={() => onDelete(observation.id)}
              onToggleResolved={() => onUpdate(observation.id, { resolved: !observation.resolved })}
            />
          )
        ))}

        {isAdding && (
          <ObservationForm
            deviceTypeOptions={deviceTypeOptions}
            onCancel={() => setIsAdding(false)}
            onSubmit={values => {
              onAdd(values);
              setIsAdding(false);
            }}
          />
        )}
      </div>
    </section>
  );
}
