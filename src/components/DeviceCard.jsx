import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import TaskRow from './TaskRow.jsx';

export default function DeviceCard({
  device,
  getTaskResult,
  setTaskStatus,
  commentBoxes,
  toggleCommentBox,
  handleCommentChange,
  handleEvidenceChange,
  toggleDeviceAllTasks,
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
            {titleParts?.connection && (
              <span className="mt-1 inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                {titleParts.connection}
              </span>
            )}
            <p className="mt-1 text-xs font-medium text-slate-500">
              {passTasks + naTasks} de {totalTasks} pruebas sin bloqueo/falla
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleDeviceAllTasks(device.tasks, isComplete)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-all active:scale-95 ${
            isComplete
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-slate-200 text-slate-600 hover:bg-blue-100 hover:text-blue-700'
          }`}
          title={isComplete ? 'Dejar pruebas como pendientes' : 'Marcar pruebas como Pass'}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isComplete ? 'COMPLETADO' : 'Marcar Pass'}
        </button>
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
          />
        ))}
      </div>
    </article>
  );
}
