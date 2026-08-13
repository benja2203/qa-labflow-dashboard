import React, { useState } from 'react';
import { Camera, CheckCircle2, ChevronDown, CreditCard } from 'lucide-react';
import TaskRow from './TaskRow.jsx';
import { TEST_STATUS } from '../constants/testStatus.js';

const BULK_STATUS_OPTIONS = ['fail', 'blocked', 'na'];
const STATUSES_REQUIRING_COMMENT = ['fail', 'blocked'];

function BulkStatusMenu({ tasks, readOnly, onApply }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [comment, setComment] = useState('');

  const close = () => {
    setIsOpen(false);
    setPendingStatus(null);
    setComment('');
  };

  const handlePickStatus = statusKey => {
    if (STATUSES_REQUIRING_COMMENT.includes(statusKey)) {
      setPendingStatus(statusKey);
      return;
    }
    onApply(tasks, statusKey, '');
    close();
  };

  const handleApplyWithComment = () => {
    if (!comment.trim()) return;
    onApply(tasks, pendingStatus, comment.trim());
    close();
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-500 transition-all hover:bg-slate-50 ${
          readOnly ? 'cursor-not-allowed opacity-60' : ''
        }`}
        title="Marcar todas las pruebas de este dispositivo con otro estado"
      >
        Marcar como…
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            {!pendingStatus ? (
              <div className="flex flex-col gap-1">
                {BULK_STATUS_OPTIONS.map(statusKey => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => handlePickStatus(statusKey)}
                    className={`rounded-md px-2.5 py-1.5 text-left text-xs font-black transition-colors hover:opacity-80 ${TEST_STATUS[statusKey].badge}`}
                  >
                    Marcar todas como {TEST_STATUS[statusKey].shortLabel}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Observación para las {tasks.length} pruebas ({TEST_STATUS[pendingStatus].shortLabel})
                </p>
                <textarea
                  autoFocus
                  value={comment}
                  onChange={event => setComment(event.target.value)}
                  placeholder="Ej: Se reemplazó el equipo por falla y se retiró antes de completar las pruebas del nuevo."
                  className="h-20 w-full resize-none rounded-md border border-slate-200 p-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingStatus(null)}
                    className="rounded-md px-2 py-1 text-[11px] font-black text-slate-500 hover:bg-slate-100"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyWithComment}
                    disabled={!comment.trim()}
                    className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-black text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Aplicar a todas
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
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
  setDeviceTasksStatus,
  readOnly,
}) {
  const totalTasks = device.tasks.length;
  const passTasks = device.tasks.filter(task => getTaskResult(task.id).status === 'pass').length;
  const naTasks = device.tasks.filter(task => getTaskResult(task.id).status === 'na').length;
  const isComplete = totalTasks > 0 && totalTasks === passTasks + naTasks;

  const titleParts = device.deviceName.includes('[Conectado a:')
    ? {
        name: device.deviceName.split(' [')[0],
        connection: device.deviceName.match(/\[(.*?)\]/)?.[1],
      }
    : null;

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
            onClick={() => toggleDeviceAllTasks(device.tasks, isComplete)}
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

          <BulkStatusMenu tasks={device.tasks} readOnly={readOnly} onApply={setDeviceTasksStatus} />
        </div>
      </header>

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
