import React, { useState } from 'react';
import { Camera, CheckCircle2, CreditCard, Lightbulb, Pencil, Trash2 } from 'lucide-react';
import TaskRow from './TaskRow.jsx';
import { TEST_STATUS } from '../constants/testStatus.js';

const BULK_STATUS_OPTIONS = ['fail', 'blocked', 'na'];
const STATUSES_REQUIRING_COMMENT = ['fail', 'blocked'];

function DeviceNoteEditor({ initialStatus, initialComment, onCancel, onSave }) {
  const [status, setStatus] = useState(initialStatus || 'blocked');
  const [comment, setComment] = useState(initialComment || '');

  const requiresComment = STATUSES_REQUIRING_COMMENT.includes(status);
  const canSave = !requiresComment || comment.trim().length > 0;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        Marcar todas las pruebas de este dispositivo como…
      </p>
      <div className="flex flex-wrap gap-1.5">
        {BULK_STATUS_OPTIONS.map(statusKey => (
          <button
            key={statusKey}
            type="button"
            onClick={() => setStatus(statusKey)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-black transition-all ${
              status === statusKey
                ? TEST_STATUS[statusKey].badge
                : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            {TEST_STATUS[statusKey].shortLabel}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={comment}
        onChange={event => setComment(event.target.value)}
        placeholder="Ej: Se reemplazó el equipo por falla y se retiró antes de completar las pruebas del nuevo."
        className="h-16 w-full resize-none rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2.5 py-1 text-[11px] font-black text-slate-500 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave(status, comment.trim())}
          className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-black text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Aplicar a todas
        </button>
      </div>
    </div>
  );
}

function DeviceNoteBanner({ deviceNote, taskCount, readOnly, onEdit, onClear }) {
  const statusConfig = TEST_STATUS[deviceNote.status] || TEST_STATUS.pending;

  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${statusConfig.badge}`}>
          {statusConfig.shortLabel}
        </span>
        <div>
          <p className="text-xs font-bold text-slate-700">
            Nota de dispositivo — aplica a {taskCount} {taskCount === 1 ? 'prueba' : 'pruebas'}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-600">{deviceNote.comment}</p>
        </div>
      </div>

      {!readOnly && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            title="Editar nota del dispositivo"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            title="Quitar nota del dispositivo"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function DeviceCard({
  device,
  getTaskResult,
  setTaskStatus,
  commentBoxes,
  toggleCommentBox,
  handleCommentChange,
  handleEvidenceChange,
  toggleDeviceAllTasks,
  deviceNote,
  onSetDeviceNote,
  onClearDeviceNote,
  readOnly,
}) {
  const [isEditingNote, setIsEditingNote] = useState(false);

  const totalTasks = device.tasks.length;
  const passTasks = device.tasks.filter(task => getTaskResult(task.id).status === 'pass').length;
  const naTasks = device.tasks.filter(task => getTaskResult(task.id).status === 'na').length;
  const isComplete = totalTasks > 0 && totalTasks === passTasks + naTasks;

  const coveredTaskCount = deviceNote
    ? device.tasks.filter(task => getTaskResult(task.id).status === deviceNote.status).length
    : 0;

  const titleParts = device.deviceName.includes('[Conectado a:')
    ? {
        name: device.deviceName.split(' [')[0],
        connection: device.deviceName.match(/\[(.*?)\]/)?.[1],
      }
    : null;

  const handleSaveNote = (status, comment) => {
    onSetDeviceNote(device.id, device.tasks, status, comment);
    setIsEditingNote(false);
  };

  return (
    <article className={`rounded-xl border bg-white shadow-sm transition-all duration-300 ${
      isComplete ? 'border-green-300 bg-green-50/20' : 'border-slate-200 hover:border-blue-200'
    }`}>
      <header className="flex flex-col gap-3 rounded-t-xl border-b border-slate-100 bg-slate-50/50 p-3 md:flex-row md:items-center md:p-4">
        <div className="flex flex-1 items-center gap-3">
          <div className={`rounded-lg p-2 shadow-sm transition-colors ${
            isComplete
              ? 'bg-green-500 text-white'
              : 'border border-slate-200 bg-white text-slate-600'
          }`}>
            {device.icon}
          </div>

          <div>
            <h4 className="text-[15px] font-bold leading-tight text-slate-800">
              {titleParts ? titleParts.name : device.deviceName}
            </h4>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {titleParts?.connection && (
                <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                  {titleParts.connection}
                </span>
              )}
              {device.doorInfo && (
                <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
                  Puerta: {device.doorInfo.name}
                  {device.doorInfo.directionLabel ? ` · ${device.doorInfo.directionLabel}` : ''}
                </span>
              )}
              {device.relayInfo?.relayLabel && (
                <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {device.relayInfo.relayLabel}
                  {device.relayInfo.actionSeconds ? ` · ${device.relayInfo.actionSeconds}s` : ''}
                </span>
              )}
              {device.cameraEnabled && (
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                  <Camera className="h-3 w-3" />
                  {device.cameraIp ? `Cám: ${device.cameraIp}` : 'Cámara IP'}
                </span>
              )}
              {device.cardReaderEnabled && (
                <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                  <CreditCard className="h-3 w-3" />
                  Lector de carnet
                </span>
              )}
              {device.signalLightEnabled && (
                <span className="inline-flex items-center gap-1 rounded-md bg-yellow-50 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                  <Lightbulb className="h-3 w-3" />
                  {device.signalLightRelay ? `Señalización: ${device.signalLightRelay}` : 'Señalización'}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {passTasks + naTasks} de {totalTasks} pruebas sin bloqueo/falla
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => toggleDeviceAllTasks(device.id, device.tasks, isComplete)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-all active:scale-95 ${
              isComplete
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-slate-200 text-slate-600 hover:bg-blue-100 hover:text-blue-700'
            } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
            title={isComplete ? 'Dejar pruebas como pendientes' : 'Marcar pruebas como Pass'}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isComplete ? 'COMPLETADO' : 'Marcar Pass'}
          </button>

          {!deviceNote && !isEditingNote && (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setIsEditingNote(true)}
              className={`flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-500 transition-all hover:bg-slate-50 ${
                readOnly ? 'cursor-not-allowed opacity-60' : ''
              }`}
              title="Marcar todas las pruebas de este dispositivo con otro estado"
            >
              Marcar como…
            </button>
          )}
        </div>
      </header>

      {deviceNote && !isEditingNote && (
        <DeviceNoteBanner
          deviceNote={deviceNote}
          taskCount={coveredTaskCount}
          readOnly={readOnly}
          onEdit={() => setIsEditingNote(true)}
          onClear={() => onClearDeviceNote(device.id)}
        />
      )}

      {isEditingNote && !readOnly && (
        <div className="border-b border-slate-100 p-3">
          <DeviceNoteEditor
            initialStatus={deviceNote?.status}
            initialComment={deviceNote?.comment}
            onCancel={() => setIsEditingNote(false)}
            onSave={handleSaveNote}
          />
        </div>
      )}

      <div className="p-1.5">
        {device.tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            taskResult={getTaskResult(task.id)}
            isCommentBoxOpen={!!commentBoxes[task.id]}
            setTaskStatus={setTaskStatus}
            toggleCommentBox={toggleCommentBox}
            handleCommentChange={handleCommentChange}
            handleEvidenceChange={handleEvidenceChange}
            readOnly={readOnly}
          />
        ))}
      </div>
    </article>
  );
}
