import { getTaskResult } from './report.js';

export function filterChecklistByPhases(checklistByPhases, taskResults, filters) {
  const statuses = filters?.statuses || [];
  const phaseNumbers = filters?.phaseNumbers || [];
  const deviceTypes = filters?.deviceTypes || [];

  const hasStatusFilter = statuses.length > 0;
  const hasPhaseFilter = phaseNumbers.length > 0;
  const hasDeviceTypeFilter = deviceTypes.length > 0;

  if (!hasStatusFilter && !hasPhaseFilter && !hasDeviceTypeFilter) {
    return checklistByPhases;
  }

  return checklistByPhases
    .filter(phase => !hasPhaseFilter || phaseNumbers.includes(phase.phaseNumber))
    .map(phase => ({
      ...phase,
      devices: phase.devices
        .filter(device => !hasDeviceTypeFilter || deviceTypes.includes(device.type))
        .map(device => ({
          ...device,
          tasks: hasStatusFilter
            ? device.tasks.filter(task => statuses.includes(getTaskResult(taskResults, task.id).status))
            : device.tasks,
        }))
        .filter(device => device.tasks.length > 0),
    }))
    .filter(phase => phase.devices.length > 0);
}

function isTaskDone(status) {
  return status === 'pass' || status === 'na';
}

export function getAvailableDeviceTypes(checklistByPhases, taskResults) {
  const progress = new Map();

  checklistByPhases.forEach(phase => {
    phase.devices.forEach(device => {
      if (!device.type) return;

      const entry = progress.get(device.type) || {
        id: device.type,
        label: device.typeName || device.type,
        total: 0,
        done: 0,
      };

      device.tasks.forEach(task => {
        entry.total += 1;
        if (isTaskDone(getTaskResult(taskResults, task.id).status)) entry.done += 1;
      });

      progress.set(device.type, entry);
    });
  });

  return Array.from(progress.values()).map(entry => ({
    ...entry,
    isComplete: entry.total > 0 && entry.total === entry.done,
  }));
}

export function getPhaseProgress(checklistByPhases, taskResults) {
  return checklistByPhases.map(phase => {
    let total = 0;
    let done = 0;

    phase.devices.forEach(device => {
      device.tasks.forEach(task => {
        total += 1;
        if (isTaskDone(getTaskResult(taskResults, task.id).status)) done += 1;
      });
    });

    return {
      phaseNumber: phase.phaseNumber,
      phaseName: phase.phaseName,
      total,
      done,
      isComplete: total > 0 && total === done,
    };
  });
}
