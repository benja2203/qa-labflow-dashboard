import { DEFAULT_TASK_RESULT } from '../constants/testStatus.js';

export function getTaskResult(taskResults, taskId) {
  return taskResults[taskId] || DEFAULT_TASK_RESULT;
}

export function getChecklistTaskIds(checklistByPhases) {
  return checklistByPhases.flatMap(phase => (
    phase.devices.flatMap(device => device.tasks.map(task => task.id))
  ));
}

export function createChecklistSummary(checklistByPhases, taskResults) {
  const summary = {
    total: 0,
    pending: 0,
    pass: 0,
    fail: 0,
    blocked: 0,
    na: 0,
  };

  checklistByPhases.forEach(phase => {
    phase.devices.forEach(device => {
      device.tasks.forEach(task => {
        const status = getTaskResult(taskResults, task.id).status;

        summary.total += 1;

        if (summary[status] !== undefined) {
          summary[status] += 1;
        } else {
          summary.pending += 1;
        }
      });
    });
  });

  summary.completed = summary.pass + summary.fail + summary.blocked + summary.na;
  summary.progressPercentage = summary.total === 0
    ? 0
    : Math.round((summary.completed / summary.total) * 100);

  return summary;
}

export function getFinalLabStatus(summary) {
  if (summary.fail > 0) return 'NO APTO';
  if (summary.blocked > 0) return 'BLOQUEADO';
  if (summary.pending > 0) return 'EN PROGRESO';
  return 'APTO';
}

export function getFinalStatusClasses(finalLabStatus) {
  const statusMap = {
    APTO: 'bg-green-100 text-green-700 border-green-200',
    'NO APTO': 'bg-red-100 text-red-700 border-red-200',
    BLOQUEADO: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'EN PROGRESO': 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return statusMap[finalLabStatus] || statusMap['EN PROGRESO'];
}

export function getReportIssues(checklistByPhases, taskResults) {
  const issues = [];

  checklistByPhases.forEach(phase => {
    phase.devices.forEach(device => {
      device.tasks.forEach(task => {
        const result = getTaskResult(taskResults, task.id);
        const hasComment = result.comment?.trim().length > 0;
        const hasEvidence = result.evidence?.trim().length > 0;
        const isIssue = ['fail', 'blocked'].includes(result.status);

        if (isIssue || hasComment || hasEvidence) {
          issues.push({
            phaseName: phase.phaseName,
            deviceName: device.deviceName,
            taskDescription: task.description,
            ...result,
          });
        }
      });
    });
  });

  return issues;
}

export function getFullReportTasks(checklistByPhases, taskResults) {
  return checklistByPhases.map(phase => ({
    phaseNumber: phase.phaseNumber,
    phaseName: phase.phaseName,
    devices: phase.devices.map(device => ({
      deviceName: device.deviceName,
      tasks: device.tasks.map((task, index) => ({
        order: index + 1,
        id: task.id,
        description: task.description,
        ...getTaskResult(taskResults, task.id),
      })),
    })),
  }));
}

export function hasChecklistFailuresWithoutComment(checklistByPhases, taskResults) {
  const currentTaskIds = new Set(getChecklistTaskIds(checklistByPhases));

  return Object.entries(taskResults).some(([taskId, result]) => {
    if (!currentTaskIds.has(taskId)) return false;

    const requiresComment = result.status === 'fail' || result.status === 'blocked';
    const hasNoComment = !result.comment || result.comment.trim().length === 0;

    return requiresComment && hasNoComment;
  });
}

export function buildReportPayload({
  selectedCommunity,
  checklistByPhases,
  taskResults,
  summary,
  finalLabStatus,
}) {
  const currentTaskIds = new Set(getChecklistTaskIds(checklistByPhases));
  const filteredTaskResults = Object.fromEntries(
    Object.entries(taskResults).filter(([taskId]) => currentTaskIds.has(taskId))
  );

  return {
    exportedAt: new Date().toISOString(),
    community: selectedCommunity,
    finalLabStatus,
    summary,
    checklistByPhases,
    taskResults: filteredTaskResults,
    issues: getReportIssues(checklistByPhases, taskResults),
    fullChecklistResults: getFullReportTasks(checklistByPhases, taskResults),
  };
}
