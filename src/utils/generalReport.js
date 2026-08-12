import { buildChecklistByPhases } from './checklist.js';
import { createChecklistSummary, getFinalLabStatus, getTaskResult } from './report.js';

function stripDoorContext(description) {
  return description.replace(/\s*\([^)]*\)$/, '').trim();
}

export function buildGeneralReport(communities, taskResults, generalObservationsByCommunity, deliveryExceptionsByCommunity) {
  const deviceStatsById = new Map();
  const failureTextCounts = new Map();
  const communitySummaries = [];
  const allObservations = [];

  const totals = { total: 0, pass: 0, fail: 0, blocked: 0, na: 0, pending: 0 };
  const statusDistribution = { APTO: 0, 'NO APTO': 0, BLOQUEADO: 0, 'EN PROGRESO': 0 };
  let deliveredUnderExceptionCount = 0;

  communities.forEach(community => {
    const checklistByPhases = buildChecklistByPhases(community);
    const summary = createChecklistSummary(checklistByPhases, taskResults);
    const finalLabStatus = getFinalLabStatus(summary);
    const exception = deliveryExceptionsByCommunity?.[community.id];
    const deliveredUnderException = Boolean(exception?.active);

    totals.total += summary.total;
    totals.pass += summary.pass;
    totals.fail += summary.fail;
    totals.blocked += summary.blocked;
    totals.na += summary.na;
    totals.pending += summary.pending;

    if (summary.total > 0) {
      statusDistribution[finalLabStatus] = (statusDistribution[finalLabStatus] || 0) + 1;
    }
    if (deliveredUnderException) deliveredUnderExceptionCount += 1;

    communitySummaries.push({
      id: community.id,
      name: community.name,
      finalLabStatus,
      summary,
      deliveredUnderException,
    });

    checklistByPhases.forEach(phase => {
      phase.devices.forEach(device => {
        if (!device.type) return;

        const entry = deviceStatsById.get(device.type) || {
          id: device.type,
          label: device.typeName || device.type,
          total: 0,
          pass: 0,
          fail: 0,
          blocked: 0,
          na: 0,
          pending: 0,
        };

        device.tasks.forEach(task => {
          const status = getTaskResult(taskResults, task.id).status;
          entry.total += 1;
          entry[status] = (entry[status] ?? 0) + 1;

          if (status === 'fail' || status === 'blocked') {
            const key = stripDoorContext(task.description);
            const current = failureTextCounts.get(key) || { description: key, count: 0, fail: 0, blocked: 0 };
            current.count += 1;
            current[status] += 1;
            failureTextCounts.set(key, current);
          }
        });

        deviceStatsById.set(device.type, entry);
      });
    });

    (generalObservationsByCommunity?.[community.id] || []).forEach(observation => {
      allObservations.push({ ...observation, communityName: community.name });
    });
  });

  const deviceBreakdown = Array.from(deviceStatsById.values())
    .map(entry => ({
      ...entry,
      failRate: entry.total > 0 ? Math.round(((entry.fail + entry.blocked) / entry.total) * 100) : 0,
    }))
    .sort((a, b) => (b.fail + b.blocked) - (a.fail + a.blocked) || b.failRate - a.failRate);

  const topFailingTests = Array.from(failureTextCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    communitiesCount: communities.length,
    totals,
    statusDistribution,
    deliveredUnderExceptionCount,
    communitySummaries,
    deviceBreakdown,
    topFailingTests,
    generalObservations: allObservations,
  };
}
