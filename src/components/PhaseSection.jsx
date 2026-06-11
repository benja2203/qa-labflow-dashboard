import React from 'react';
import DeviceCard from './DeviceCard.jsx';

export default function PhaseSection({
  phase,
  getTaskResult,
  setTaskStatus,
  commentBoxes,
  toggleCommentBox,
  handleCommentChange,
  handleEvidenceChange,
  toggleDeviceAllTasks,
}) {
  return (
    <section className="relative">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white shadow-sm">
          {phase.phaseNumber}
        </span>
        <h3 className="text-lg font-black tracking-tight text-slate-800">
          {phase.phaseName}
        </h3>
        <div className="ml-4 h-px flex-1 bg-slate-200" />
      </div>

      <div className="space-y-4 pl-4 md:pl-11">
        {phase.devices.map(device => (
          <DeviceCard
            key={device.id}
            device={device}
            getTaskResult={getTaskResult}
            setTaskStatus={setTaskStatus}
            commentBoxes={commentBoxes}
            toggleCommentBox={toggleCommentBox}
            handleCommentChange={handleCommentChange}
            handleEvidenceChange={handleEvidenceChange}
            toggleDeviceAllTasks={toggleDeviceAllTasks}
          />
        ))}
      </div>
    </section>
  );
}
