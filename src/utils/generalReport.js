import { buildChecklistByPhases } from './checklist.js';
import { createChecklistSummary, getFinalLabStatus, getTaskResult } from './report.js';
import { resolveObservationStatus } from '../constants/observationStatus.js';
import { PROCESS_SCOPE } from '../constants/observationScopes.js';

function stripDoorContext(description) {
  return description.replace(/\s*\([^)]*\)$/, '').trim();
}

function isProcessObservation(observation) {
  return Array.isArray(observation.scope) && observation.scope.includes(PROCESS_SCOPE.id);
}

export function buildGeneralReport(communities, taskResults, generalObservationsByCommunity, deliveryExceptionsByCommunity, closedProjectsByCommunity) {
  const deviceStatsById = new Map();
  const failureTextCounts = new Map();
  const installerStatsByName = new Map();
  const communitySummaries = [];
  const allObservations = [];

  const totals = { total: 0, pass: 0, fail: 0, blocked: 0, na: 0, pending: 0 };
  const statusDistribution = { APTO: 0, 'NO APTO': 0, BLOQUEADO: 0, 'EN PROGRESO': 0 };
  let deliveredUnderExceptionCount = 0;
  let closedCount = 0;
  let approvedCommunitiesCount = 0;
  let evaluatedCommunitiesCount = 0;

  communities.forEach(community => {
    const closedProject = closedProjectsByCommunity?.[community.id];
    const isClosed = Boolean(closedProject?.closed);
    // Una comunidad cerrada usa la foto congelada al cerrarla, no el catálogo
    // actual, para que el reporte agregado no cambie retroactivamente.
    const checklistByPhases = isClosed ? (closedProject.checklistByPhases || []) : buildChecklistByPhases(community);
    const communityTaskResults = isClosed ? (closedProject.taskResults || {}) : taskResults;
    const summary = createChecklistSummary(checklistByPhases, communityTaskResults);
    const finalLabStatus = getFinalLabStatus(summary);
    const exception = deliveryExceptionsByCommunity?.[community.id];
    const deliveredUnderException = Boolean(exception?.active);

    if (isClosed) closedCount += 1;

    totals.total += summary.total;
    totals.pass += summary.pass;
    totals.fail += summary.fail;
    totals.blocked += summary.blocked;
    totals.na += summary.na;
    totals.pending += summary.pending;

    if (summary.total > 0) {
      statusDistribution[finalLabStatus] = (statusDistribution[finalLabStatus] || 0) + 1;
      evaluatedCommunitiesCount += 1;
      if (finalLabStatus === 'APTO') approvedCommunitiesCount += 1;

      const installerName = community.installerName?.trim() || 'Sin asignar';
      const installerEntry = installerStatsByName.get(installerName) || {
        name: installerName,
        incidentCount: 0,
        communitiesCount: 0,
      };
      installerEntry.incidentCount += summary.fail + summary.blocked;
      installerEntry.communitiesCount += 1;
      installerStatsByName.set(installerName, installerEntry);
    }
    if (deliveredUnderException) deliveredUnderExceptionCount += 1;

    const communityObservations = generalObservationsByCommunity?.[community.id] || [];
    const hasProcessObservation = communityObservations.some(isProcessObservation);

    communitySummaries.push({
      id: community.id,
      name: community.name,
      installerName: community.installerName?.trim() || '',
      finalLabStatus,
      summary,
      deliveredUnderException,
      isClosed,
      hasProcessObservation,
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
          const status = getTaskResult(communityTaskResults, task.id).status;
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

    communityObservations.forEach(observation => {
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

  const pendingObservationsCount = allObservations.filter(observation => resolveObservationStatus(observation) === 'pending').length;
  const inReviewObservationsCount = allObservations.filter(observation => resolveObservationStatus(observation) === 'in_review').length;
  const resolvedObservationsCount = allObservations.filter(observation => resolveObservationStatus(observation) === 'resolved').length;

  const processObservations = allObservations.filter(isProcessObservation);
  const installationNotReadyCount = processObservations.length;
  const technicalFailureCount = totals.fail + totals.blocked;
  const approvalRate = evaluatedCommunitiesCount > 0
    ? Math.round((approvedCommunitiesCount / evaluatedCommunitiesCount) * 100)
    : 0;

  const installerBreakdown = Array.from(installerStatsByName.values())
    .filter(entry => entry.incidentCount > 0)
    .sort((a, b) => b.incidentCount - a.incidentCount)
    .slice(0, 8);

  const noAptoCount = statusDistribution['NO APTO'] || 0;
  const noAptoWithProcessObservationCount = communitySummaries.filter(
    entry => entry.finalLabStatus === 'NO APTO' && entry.hasProcessObservation
  ).length;

  return {
    communitiesCount: communities.length,
    totals,
    statusDistribution,
    deliveredUnderExceptionCount,
    closedCount,
    approvalRate,
    communitySummaries,
    deviceBreakdown,
    topFailingTests,
    installerBreakdown,
    generalObservations: allObservations,
    processObservations,
    installationNotReadyCount,
    technicalFailureCount,
    noAptoCount,
    noAptoWithProcessObservationCount,
    pendingObservationsCount,
    inReviewObservationsCount,
    resolvedObservationsCount,
  };
}
