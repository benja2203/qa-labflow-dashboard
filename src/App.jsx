import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Upload } from 'lucide-react';
import { DEVICE_CATALOG, INITIAL_COMMUNITIES } from './data/deviceCatalog.jsx';
import { DEFAULT_TASK_RESULT } from './constants/testStatus.js';
import { DEFAULT_INSTANCE_LINK } from './constants/accessConfig.js';
import { useLocalStorageState } from './hooks/useLocalStorageState.js';
import { buildChecklistByPhases, hydrateSnapshotIcons, stripIconsForSnapshot } from './utils/checklist.js';
import {
  buildReportPayload,
  createChecklistSummary,
  getChecklistDeviceIds,
  getChecklistTaskIds,
  getFinalLabStatus,
  getTaskResult as readTaskResult,
  hasChecklistFailuresWithoutComment,
} from './utils/report.js';
import Sidebar from './components/Sidebar.jsx';
import CommunityForm from './components/CommunityForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import ReportModal from './components/ReportModal.jsx';
import GeneralReportView from './components/GeneralReportView.jsx';
import BackupSettingsModal from './components/BackupSettingsModal.jsx';
import { sendExceptionBackup } from './utils/externalBackup.js';



const LEGACY_CONTROLLER_TYPE = ['mod', 'berry'].join('');
const LEGACY_CONTROLLER_LABEL = new RegExp(['mod', 'berry'].join(''), 'gi');
const LEGACY_GUARD_TYPE = 'guard';

function normalizePeripheralConfig(peripheral) {
  const qty = Math.max(1, Number(peripheral.qty) || 1);
  const existingInstances = Array.isArray(peripheral.instances) ? peripheral.instances : [];

  return {
    ...peripheral,
    qty,
    instances: Array.from({ length: qty }, (_, index) => {
      const existing = existingInstances[index];

      return {
        ...DEFAULT_INSTANCE_LINK,
        id: String(existing?.id ?? index),
        label: existing?.label || '',
        doorId: existing?.doorId || '',
        direction: existing?.direction || '',
        port: existing?.port || '',
        portNote: existing?.portNote || '',
        ip: existing?.ip || '',
        relaySource: existing?.relaySource || 'controller',
        relays: Array.isArray(existing?.relays)
          ? existing.relays
          : (existing?.relay ? [existing.relay] : []),
        relayNote: existing?.relayNote || '',
        actionSeconds: existing?.actionSeconds || '',
        cameraEnabled: existing?.cameraEnabled ?? false,
        cameraIp: existing?.cameraIp || '',
        cardReaderEnabled: existing?.cardReaderEnabled ?? false,
        signalLightEnabled: existing?.signalLightEnabled ?? false,
        signalLightRelay: existing?.signalLightRelay || '',
        signalLightSeconds: existing?.signalLightSeconds || '',
      };
    }),
  };
}

function normalizeDoor(door) {
  return {
    id: String(door?.id ?? `door-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    name: door?.name || '',
    zone: door?.zone || '',
    type: door?.type || 'peatonal',
  };
}

function normalizeCommunity(community) {
  if (!community) return community;

  // Collect module IDs that ended up as peripherals (e.g. "remoto" before it became a module)
  const migratedModuleIds = new Set();
  (community.nodes || []).forEach(node => {
    (node.peripherals || []).forEach(p => {
      const entry = DEVICE_CATALOG[p.type];
      if (entry && entry.role === 'optionalModule') migratedModuleIds.add(p.type);
    });
  });

  const baseModules = Array.isArray(community.modules)
    ? community.modules
    : Array.isArray(community.enabledModules)
      ? community.enabledModules
      : [];
  const mergedModules = [...new Set([...baseModules, ...migratedModuleIds])];

  return {
    ...community,
    technicianName: community.technicianName || '',
    installerName: community.installerName || '',
    modules: mergedModules,
    rules: {
      ...(community.rules || {}),
      antipassback: Boolean(community.rules?.antipassback),
      antipassbackDoorIds: Array.isArray(community.rules?.antipassbackDoorIds)
        ? community.rules.antipassbackDoorIds
        : [],
      multivalidation: Boolean(community.rules?.multivalidation),
      multivalidationDoorIds: Array.isArray(community.rules?.multivalidationDoorIds)
        ? community.rules.multivalidationDoorIds
        : [],
      cancelInvitation: Boolean(community.rules?.cancelInvitation),
      cancelInvitationDoorIds: Array.isArray(community.rules?.cancelInvitationDoorIds)
        ? community.rules.cancelInvitationDoorIds
        : [],
    },
    nodes: (community.nodes || []).map(node => ({
      ...node,
      type: node.type === LEGACY_CONTROLLER_TYPE ? 'controller' : node.type,
      label: String(node.label || '').replace(LEGACY_CONTROLLER_LABEL, 'Controlador'),
      doors: Array.isArray(node.doors) ? node.doors.map(normalizeDoor) : [],
      peripherals: (node.peripherals || [])
        .map(p => (p.type === LEGACY_GUARD_TYPE ? { ...p, type: 'guardDesk' } : p))
        .filter(p => {
          const entry = DEVICE_CATALOG[p.type];
          return entry && entry.role === 'peripheral';
        })
        .map(normalizePeripheralConfig),
    })),
  };
}

// Migración única: los IDs de prueba pasaron de ser posicionales
// (...-test-0, ...-test-1) a derivarse del texto de cada prueba
// (...-test-{hash}), para que insertar/reordenar/agregar pruebas en el
// catálogo ya no le pegue el resultado guardado de una prueba a otra
// distinta (bug real: al agregar pruebas mientras se estaba testeando, las
// nuevas heredaban el Pass de la que antes ocupaba esa posición). Esto
// remapea los taskResults ya guardados con el esquema viejo al nuevo, sin
// pisar nada si ya existiera un resultado bajo el id nuevo.
function migrateTaskResultsToStableIds(communities, taskResults) {
  let migrated = taskResults;
  let didMigrate = false;

  communities.forEach(community => {
    const checklistByPhases = buildChecklistByPhases(community);

    checklistByPhases.forEach(phase => {
      phase.devices.forEach(device => {
        if (!device.rawBaseId) return;

        device.tasks.forEach((task, index) => {
          const legacyId = `community-${community.id}-${device.rawBaseId}-test-${index}`;
          if (legacyId === task.id) return;
          if (!(legacyId in taskResults)) return;
          if (task.id in taskResults) return;

          if (!didMigrate) {
            migrated = { ...taskResults };
            didMigrate = true;
          }
          migrated[task.id] = migrated[legacyId];
        });
      });
    });
  });

  return { migrated, didMigrate };
}

function EmptyDashboard({ onCreateCommunity, onImportJson }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <ClipboardCheck className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-black tracking-tight text-slate-800">
        No hay comunidades creadas
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Crea una comunidad, agrega sus controladores y conecta los periféricos para generar el checklist QA dinámico.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onCreateCommunity}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Crear primera comunidad
        </button>
        <button
          type="button"
          onClick={onImportJson}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Upload className="h-4 w-4" />
          Importar JSON
        </button>
      </div>
    </section>
  );
}


function parseImportedPayload(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }

  // El payload exportado tiene { community, taskResults, ... }
  const community = parsed.community;
  if (!community || typeof community !== 'object' || !community.name) {
    throw new Error('El JSON no contiene una comunidad válida (falta "community" o "name").');
  }

  const taskResults =
    parsed.taskResults && typeof parsed.taskResults === 'object'
      ? parsed.taskResults
      : {};

  const generalObservations = Array.isArray(parsed.generalObservations)
    ? parsed.generalObservations
    : [];

  const deliveryException = parsed.deliveryException && typeof parsed.deliveryException === 'object'
    ? parsed.deliveryException
    : null;

  const closedProject = parsed.closedProject && typeof parsed.closedProject === 'object'
    ? parsed.closedProject
    : null;

  const deviceNotes = parsed.deviceNotes && typeof parsed.deviceNotes === 'object'
    ? parsed.deviceNotes
    : {};

  return { community, taskResults, generalObservations, deliveryException, closedProject, deviceNotes };
}

// El snapshot de un proyecto cerrado guarda los taskId con el prefijo
// `community-{id}-...` de cuando se cerró. Si al importar se reasigna el id
// de la comunidad, hay que reescribir esos prefijos igual que con taskResults.
function remapClosedProjectIds(closedProject, oldId, newId) {
  if (!closedProject) return closedProject;

  const oldPrefix = `community-${oldId}-`;
  const newPrefix = `community-${newId}-`;
  const remapId = id => (typeof id === 'string' && id.startsWith(oldPrefix) ? newPrefix + id.slice(oldPrefix.length) : id);

  return {
    ...closedProject,
    checklistByPhases: (closedProject.checklistByPhases || []).map(phase => ({
      ...phase,
      devices: (phase.devices || []).map(device => ({
        ...device,
        id: remapId(device.id),
        tasks: (device.tasks || []).map(task => ({ ...task, id: remapId(task.id) })),
      })),
    })),
    taskResults: Object.fromEntries(
      Object.entries(closedProject.taskResults || {}).map(([taskId, result]) => [remapId(taskId), result])
    ),
    deviceNotes: Object.fromEntries(
      Object.entries(closedProject.deviceNotes || {}).map(([deviceId, note]) => [remapId(deviceId), note])
    ),
  };
}

// Reescribe las claves de un mapa `{ id: valor }` cuyos ids empiezan con el
// prefijo `community-{oldId}-...` al nuevo id de comunidad. Se usa tanto para
// taskResults como para deviceNotes al importar con un id reasignado.
function remapIdKeyedMap(map, oldId, newId) {
  const oldPrefix = `community-${oldId}-`;
  const newPrefix = `community-${newId}-`;

  return Object.fromEntries(
    Object.entries(map || {}).map(([key, value]) => [
      key.startsWith(oldPrefix) ? newPrefix + key.slice(oldPrefix.length) : key,
      value,
    ])
  );
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'comunidad';
}



export default function App() {
  const [communities, setCommunities] = useLocalStorageState('qa-labflow-communities', INITIAL_COMMUNITIES);
  const [selectedCommunityId, setSelectedCommunityId] = useLocalStorageState('qa-labflow-selected-community', null);
  const [taskResults, setTaskResults] = useLocalStorageState('qa-labflow-task-results', {});
  const [generalObservations, setGeneralObservations] = useLocalStorageState('qa-labflow-general-observations', {});
  const [deliveryExceptions, setDeliveryExceptions] = useLocalStorageState('qa-labflow-delivery-exceptions', {});
  const [closedProjects, setClosedProjects] = useLocalStorageState('qa-labflow-closed-projects', {});
  const [deviceNotes, setDeviceNotes] = useLocalStorageState('qa-labflow-device-notes', {});
  const [taskIdsMigrated, setTaskIdsMigrated] = useLocalStorageState('qa-labflow-taskid-migration-v1', false);
  const [backupWebhookUrl, setBackupWebhookUrl] = useLocalStorageState('qa-labflow-backup-webhook-url', '');
  const [showBackupSettings, setShowBackupSettings] = useState(false);

  const [commentBoxes, setCommentBoxes] = useState({});
  const [showReport, setShowReport] = useState(false);
  const [view, setView] = useState('dashboard');
  const [editingCommunityId, setEditingCommunityId] = useState(null);
  const [importStripResults, setImportStripResults] = useState(false);
  const fileInputRef = React.useRef(null);

  const normalizedCommunities = useMemo(() => {
    return communities.map(normalizeCommunity);
  }, [communities]);

  useEffect(() => {
    if (taskIdsMigrated) return;

    const { migrated, didMigrate } = migrateTaskResultsToStableIds(normalizedCommunities, taskResults);
    if (didMigrate) setTaskResults(migrated);
    setTaskIdsMigrated(true);
    // Corre una única vez (gateado por taskIdsMigrated persistido en
    // localStorage): no depende de normalizedCommunities/taskResults a
    // propósito, para no volver a dispararse en cada cambio de datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIdsMigrated]);

  const selectedCommunity = useMemo(() => {
    return normalizedCommunities.find(community => community.id === selectedCommunityId) || normalizedCommunities[0] || null;
  }, [normalizedCommunities, selectedCommunityId]);

  const editingCommunity = useMemo(() => {
    if (!editingCommunityId) return null;
    return normalizedCommunities.find(community => community.id === editingCommunityId) || null;
  }, [normalizedCommunities, editingCommunityId]);

  const liveChecklistByPhases = useMemo(() => {
    return buildChecklistByPhases(selectedCommunity);
  }, [selectedCommunity]);

  const currentClosedProject = useMemo(() => (
    selectedCommunity ? (closedProjects[selectedCommunity.id] || null) : null
  ), [closedProjects, selectedCommunity]);

  const isCommunityClosed = Boolean(currentClosedProject?.closed);

  // Un proyecto cerrado ya no se recalcula desde el catálogo actual: se muestra
  // tal cual quedó la "foto" tomada al momento de cerrarlo, para que cambios
  // futuros en las pruebas no le agreguen pendientes a algo ya entregado.
  const checklistByPhases = useMemo(() => (
    isCommunityClosed ? hydrateSnapshotIcons(currentClosedProject.checklistByPhases) : liveChecklistByPhases
  ), [isCommunityClosed, currentClosedProject, liveChecklistByPhases]);

  const effectiveTaskResults = isCommunityClosed ? (currentClosedProject.taskResults || {}) : taskResults;
  const effectiveDeviceNotes = isCommunityClosed ? (currentClosedProject.deviceNotes || {}) : deviceNotes;

  const summary = useMemo(() => {
    return createChecklistSummary(checklistByPhases, effectiveTaskResults);
  }, [checklistByPhases, effectiveTaskResults]);

  const finalLabStatus = useMemo(() => getFinalLabStatus(summary), [summary]);

  const currentGeneralObservations = useMemo(() => (
    selectedCommunity ? (generalObservations[selectedCommunity.id] || []) : []
  ), [generalObservations, selectedCommunity]);

  const currentDeliveryException = useMemo(() => (
    selectedCommunity ? (deliveryExceptions[selectedCommunity.id] || null) : null
  ), [deliveryExceptions, selectedCommunity]);

  const getTaskResult = taskId => readTaskResult(effectiveTaskResults, taskId);

  const updateTaskResult = (taskId, patch) => {
    if (isCommunityClosed) return;

    setTaskResults(prev => ({
      ...prev,
      [taskId]: {
        ...DEFAULT_TASK_RESULT,
        ...(prev[taskId] || {}),
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const setTaskStatus = (taskId, status) => {
    updateTaskResult(taskId, { status });
  };

  const handleCommentChange = (taskId, text) => {
    updateTaskResult(taskId, { comment: text });
  };

  const handleEvidenceChange = (taskId, text) => {
    updateTaskResult(taskId, { evidence: text });
  };

  const toggleCommentBox = taskId => {
    setCommentBoxes(prev => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const toggleDeviceAllTasks = (deviceId, tasks, isComplete) => {
    if (isCommunityClosed) return;

    setTaskResults(prev => {
      const nextState = { ...prev };
      const nextStatus = isComplete ? 'pending' : 'pass';

      tasks.forEach(task => {
        nextState[task.id] = {
          ...DEFAULT_TASK_RESULT,
          ...(nextState[task.id] || {}),
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        };
      });

      return nextState;
    });

    // Otra acción en bloque sobre las mismas pruebas: la nota de dispositivo
    // anterior (si había) ya no aplica.
    clearDeviceNote(deviceId);
  };

  const setDeviceNote = (deviceId, tasks, status, comment) => {
    if (isCommunityClosed) return;

    setTaskResults(prev => {
      const nextState = { ...prev };

      tasks.forEach(task => {
        nextState[task.id] = {
          ...DEFAULT_TASK_RESULT,
          ...(nextState[task.id] || {}),
          status,
          updatedAt: new Date().toISOString(),
        };
      });

      return nextState;
    });

    setDeviceNotes(prev => ({
      ...prev,
      [deviceId]: {
        status,
        comment,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const clearDeviceNote = deviceId => {
    if (isCommunityClosed) return;

    setDeviceNotes(prev => {
      if (!prev[deviceId]) return prev;
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
  };

  const handleAddGeneralObservation = ({ title, description, scope }) => {
    if (!selectedCommunity) return;

    const newObservation = {
      id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      description,
      scope,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setGeneralObservations(prev => ({
      ...prev,
      [selectedCommunity.id]: [...(prev[selectedCommunity.id] || []), newObservation],
    }));
  };

  const handleUpdateGeneralObservation = (observationId, patch) => {
    if (!selectedCommunity) return;

    setGeneralObservations(prev => ({
      ...prev,
      [selectedCommunity.id]: (prev[selectedCommunity.id] || []).map(observation => (
        observation.id === observationId
          ? { ...observation, ...patch, updatedAt: new Date().toISOString() }
          : observation
      )),
    }));
  };

  const handleDeleteGeneralObservation = observationId => {
    if (!selectedCommunity) return;

    const confirmed = window.confirm('¿Eliminar esta observación general?');
    if (!confirmed) return;

    setGeneralObservations(prev => ({
      ...prev,
      [selectedCommunity.id]: (prev[selectedCommunity.id] || []).filter(observation => observation.id !== observationId),
    }));
  };

  const sendDeliveryExceptionBackup = async (communityId, exceptionRecord) => {
    setDeliveryExceptions(prev => {
      const current = prev[communityId];
      if (!current) return prev;
      return { ...prev, [communityId]: { ...current, backupStatus: 'sending' } };
    });

    const result = await sendExceptionBackup(backupWebhookUrl, {
      type: 'delivery_exception',
      communityName: normalizedCommunities.find(c => c.id === communityId)?.name || '',
      technicianName: normalizedCommunities.find(c => c.id === communityId)?.technicianName || '',
      authorizedBy: exceptionRecord.authorizedBy,
      reason: exceptionRecord.reason,
      signatureDataUrl: exceptionRecord.signatureDataUrl,
      registeredAt: exceptionRecord.updatedAt,
    });

    setDeliveryExceptions(prev => {
      const current = prev[communityId];
      if (!current) return prev;
      return {
        ...prev,
        [communityId]: {
          ...current,
          backupStatus: result.sent ? 'sent' : (result.reason === 'not-configured' ? 'not-configured' : 'failed'),
          backupAttemptedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleSetDeliveryException = ({ authorizedBy, reason, signatureDataUrl }) => {
    if (!selectedCommunity) return;
    const communityId = selectedCommunity.id;

    const exceptionRecord = {
      active: true,
      authorizedBy,
      reason,
      signatureDataUrl: signatureDataUrl || '',
      createdAt: deliveryExceptions[communityId]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDeliveryExceptions(prev => ({ ...prev, [communityId]: exceptionRecord }));
    sendDeliveryExceptionBackup(communityId, exceptionRecord);
  };

  const handleRetryDeliveryExceptionBackup = () => {
    if (!selectedCommunity) return;
    const current = deliveryExceptions[selectedCommunity.id];
    if (!current) return;
    sendDeliveryExceptionBackup(selectedCommunity.id, current);
  };

  const handleClearDeliveryException = () => {
    if (!selectedCommunity) return;

    const confirmed = window.confirm('¿Quitar la excepción de entrega registrada para esta comunidad?');
    if (!confirmed) return;

    setDeliveryExceptions(prev => {
      const next = { ...prev };
      delete next[selectedCommunity.id];
      return next;
    });
  };

  const handleCloseProject = () => {
    if (!selectedCommunity || isCommunityClosed) return;

    const confirmed = window.confirm(
      `¿Cerrar "${selectedCommunity.name}" como entregado? El checklist quedará congelado tal como está ahora (pruebas, resultados, comentarios y evidencia). No se va a poder editar la topología ni los resultados hasta reabrirlo.`
    );
    if (!confirmed) return;

    const currentTaskIds = new Set(getChecklistTaskIds(liveChecklistByPhases));
    const taskResultsSnapshot = Object.fromEntries(
      Object.entries(taskResults).filter(([taskId]) => currentTaskIds.has(taskId))
    );

    const currentDeviceIds = new Set(getChecklistDeviceIds(liveChecklistByPhases));
    const deviceNotesSnapshot = Object.fromEntries(
      Object.entries(deviceNotes).filter(([deviceId]) => currentDeviceIds.has(deviceId))
    );

    setClosedProjects(prev => ({
      ...prev,
      [selectedCommunity.id]: {
        closed: true,
        closedAt: new Date().toISOString(),
        checklistByPhases: stripIconsForSnapshot(liveChecklistByPhases),
        taskResults: taskResultsSnapshot,
        deviceNotes: deviceNotesSnapshot,
      },
    }));
  };

  const handleReopenProject = () => {
    if (!selectedCommunity || !isCommunityClosed) return;

    const confirmed = window.confirm(
      `¿Reabrir "${selectedCommunity.name}"? Se pierde la foto congelada: el checklist va a volver a calcularse con las pruebas actuales del sistema, y si se agregaron pruebas nuevas desde que se cerró van a aparecer como pendientes.`
    );
    if (!confirmed) return;

    setClosedProjects(prev => {
      const next = { ...prev };
      delete next[selectedCommunity.id];
      return next;
    });
  };

  const handleCommunityChange = id => {
    setSelectedCommunityId(id);
    setEditingCommunityId(null);
    setView('dashboard');
    setShowReport(false);
  };

  const handleCreateCommunity = () => {
    setEditingCommunityId(null);
    setView('create');
    setShowReport(false);
  };

  const handleShowGeneralReport = () => {
    setEditingCommunityId(null);
    setView('generalReport');
    setShowReport(false);
  };

  const handleEditCommunity = () => {
    if (!selectedCommunity || isCommunityClosed) return;
    setEditingCommunityId(selectedCommunity.id);
    setView('create');
    setShowReport(false);
  };

  const handleSaveCommunity = communityPayload => {
    const communityId = communityPayload.id || Date.now();
    const normalizedCommunity = normalizeCommunity({
      ...communityPayload,
      id: communityId,
    });

    setCommunities(prev => {
      const exists = prev.some(community => community.id === communityId);

      if (exists) {
        return prev.map(community => (
          community.id === communityId ? normalizedCommunity : community
        ));
      }

      return [...prev, normalizedCommunity];
    });

    setSelectedCommunityId(communityId);
    setEditingCommunityId(null);
    setView('dashboard');
    setShowReport(false);
  };

  const handleDeleteCommunity = communityId => {
    const communityToDelete = normalizedCommunities.find(community => community.id === communityId);
    const confirmed = window.confirm(`¿Eliminar "${communityToDelete?.name || 'esta comunidad'}" y su checklist guardado?`);

    if (!confirmed) return;

    setCommunities(prev => {
      const nextCommunities = prev.filter(community => community.id !== communityId);

      if (selectedCommunity?.id === communityId) {
        setSelectedCommunityId(nextCommunities[0]?.id || null);
      }

      if (editingCommunityId === communityId) {
        setEditingCommunityId(null);
        setView('dashboard');
      }

      return nextCommunities;
    });

    setTaskResults(prev => Object.fromEntries(
      Object.entries(prev).filter(([taskId]) => !taskId.startsWith(`community-${communityId}-`))
    ));

    setDeviceNotes(prev => Object.fromEntries(
      Object.entries(prev).filter(([deviceId]) => !deviceId.startsWith(`community-${communityId}-`))
    ));

    setGeneralObservations(prev => {
      const next = { ...prev };
      delete next[communityId];
      return next;
    });

    setDeliveryExceptions(prev => {
      const next = { ...prev };
      delete next[communityId];
      return next;
    });

    setClosedProjects(prev => {
      const next = { ...prev };
      delete next[communityId];
      return next;
    });

    setCommentBoxes({});
    setShowReport(false);
  };

  const handleResetCurrentChecklist = () => {
    if (!selectedCommunity || isCommunityClosed) return;

    const confirmed = window.confirm(`¿Reiniciar el checklist de "${selectedCommunity.name}"? Se borrarán estados, comentarios y evidencia de esta comunidad.`);
    if (!confirmed) return;

    const taskIds = new Set(getChecklistTaskIds(checklistByPhases));
    const deviceIds = new Set(getChecklistDeviceIds(checklistByPhases));

    setTaskResults(prev => Object.fromEntries(
      Object.entries(prev).filter(([taskId]) => !taskIds.has(taskId))
    ));

    setDeviceNotes(prev => Object.fromEntries(
      Object.entries(prev).filter(([deviceId]) => !deviceIds.has(deviceId))
    ));

    setCommentBoxes({});
    setShowReport(false);
  };

  const handleExportCurrentJson = () => {
    if (!selectedCommunity) return;

    const payload = buildReportPayload({
      selectedCommunity,
      checklistByPhases,
      taskResults: effectiveTaskResults,
      summary,
      finalLabStatus,
      generalObservations: currentGeneralObservations,
      deliveryException: currentDeliveryException,
      closedProject: currentClosedProject,
      deviceNotes: effectiveDeviceNotes,
    });

    const filename = `qa-labflow-${sanitizeFilename(selectedCommunity.name)}-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(filename, payload);
  };

  // Archivar = exportar TODO el proyecto (topología, resultados,
  // observaciones, excepción de entrega, foto de cierre) a un JSON, y
  // después sacarlo de localStorage para liberar espacio. Solo aplica a
  // proyectos ya cerrados -- no tiene sentido archivar algo en progreso, y
  // evita borrar por error algo que todavía se está probando.
  const handleArchiveClosedProject = () => {
    if (!selectedCommunity || !isCommunityClosed) return;

    const confirmed = window.confirm(
      `Esto va a descargar un JSON completo de "${selectedCommunity.name}" (topología, resultados, observaciones, excepción de entrega) y ELIMINARLO de este navegador para liberar espacio.\n\n` +
      'El archivo descargado queda como el único respaldo de acá en adelante -- guardalo en un lugar seguro. Esta acción no se puede deshacer desde la app.\n\n' +
      '¿Continuar?'
    );
    if (!confirmed) return;

    const payload = buildReportPayload({
      selectedCommunity,
      checklistByPhases,
      taskResults: effectiveTaskResults,
      summary,
      finalLabStatus,
      generalObservations: currentGeneralObservations,
      deliveryException: currentDeliveryException,
      closedProject: currentClosedProject,
      deviceNotes: effectiveDeviceNotes,
    });

    const filename = `qa-labflow-${sanitizeFilename(selectedCommunity.name)}-archivado-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(filename, payload);

    const communityId = selectedCommunity.id;

    setCommunities(prev => {
      const nextCommunities = prev.filter(community => community.id !== communityId);
      setSelectedCommunityId(nextCommunities[0]?.id || null);
      return nextCommunities;
    });

    setTaskResults(prev => Object.fromEntries(
      Object.entries(prev).filter(([taskId]) => !taskId.startsWith(`community-${communityId}-`))
    ));

    setDeviceNotes(prev => Object.fromEntries(
      Object.entries(prev).filter(([deviceId]) => !deviceId.startsWith(`community-${communityId}-`))
    ));

    setGeneralObservations(prev => {
      const next = { ...prev };
      delete next[communityId];
      return next;
    });

    setDeliveryExceptions(prev => {
      const next = { ...prev };
      delete next[communityId];
      return next;
    });

    setClosedProjects(prev => {
      const next = { ...prev };
      delete next[communityId];
      return next;
    });

    setCommentBoxes({});
    setShowReport(false);
  };

  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportJson = event => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const {
        community,
        taskResults: parsedResults,
        generalObservations: parsedObservations,
        deliveryException: parsedDeliveryException,
        closedProject: parsedClosedProject,
        deviceNotes: parsedDeviceNotes,
      } = parseImportedPayload(reader.result);
      const importedResults = importStripResults ? {} : parsedResults;
      const importedObservations = importStripResults ? [] : parsedObservations;
      const importedDeliveryException = importStripResults ? null : parsedDeliveryException;
      const importedClosedProject = importStripResults ? null : parsedClosedProject;
      const importedDeviceNotes = importStripResults ? {} : parsedDeviceNotes;
      const importedCommunity = normalizeCommunity(community);

      // Conserva el id original; si choca con uno existente, genera uno nuevo
      const idExists = communities.some(c => c.id === importedCommunity.id);
      const finalId = !importedCommunity.id || idExists ? Date.now() : importedCommunity.id;

      let remappedResults = importedResults;

      // Si reasignamos id, hay que reescribir los prefijos de los taskId
      if (finalId !== importedCommunity.id) {
        const oldPrefix = `community-${importedCommunity.id}-`;
        const newPrefix = `community-${finalId}-`;
        remappedResults = Object.fromEntries(
          Object.entries(importedResults).map(([taskId, result]) => [
            taskId.startsWith(oldPrefix)
              ? newPrefix + taskId.slice(oldPrefix.length)
              : taskId,
            result,
          ])
        );
      }

      const communityToAdd = { ...importedCommunity, id: finalId };
      const remappedClosedProject = finalId !== importedCommunity.id
        ? remapClosedProjectIds(importedClosedProject, importedCommunity.id, finalId)
        : importedClosedProject;
      const remappedDeviceNotes = finalId !== importedCommunity.id
        ? remapIdKeyedMap(importedDeviceNotes, importedCommunity.id, finalId)
        : importedDeviceNotes;

      setCommunities(prev => [...prev, communityToAdd]);
      setTaskResults(prev => ({ ...prev, ...remappedResults }));
      setDeviceNotes(prev => ({ ...prev, ...remappedDeviceNotes }));
      setGeneralObservations(prev => ({ ...prev, [finalId]: importedObservations }));
      if (importedDeliveryException) {
        setDeliveryExceptions(prev => ({ ...prev, [finalId]: importedDeliveryException }));
      }
      if (remappedClosedProject) {
        setClosedProjects(prev => ({ ...prev, [finalId]: remappedClosedProject }));
      }
      setSelectedCommunityId(finalId);
      setView('dashboard');
      setShowReport(false);

      window.alert(`Comunidad "${communityToAdd.name}" importada correctamente.`);
    } catch (error) {
      window.alert(`No se pudo importar: ${error.message}`);
    } finally {
      // Permite volver a importar el mismo archivo si hace falta
      event.target.value = '';
    }
  };

  reader.onerror = () => {
    window.alert('Error al leer el archivo.');
    event.target.value = '';
  };

  reader.readAsText(file);
};

  const handleShowReport = () => {
    if (hasChecklistFailuresWithoutComment(checklistByPhases, effectiveTaskResults, effectiveDeviceNotes)) {
      window.alert('Hay pruebas en Fail o Blocked sin observación técnica. Puedes revisar el reporte, pero completa esos comentarios antes de cerrarlo formalmente.');
    }

    setShowReport(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans md:flex">
      <Sidebar
        communities={normalizedCommunities}
        selectedCommunityId={selectedCommunity?.id}
        view={view}
        onSelectCommunity={handleCommunityChange}
        onCreateCommunity={handleCreateCommunity}
        onDeleteCommunity={handleDeleteCommunity}
        onImportJson={handleTriggerImport}
        onShowGeneralReport={handleShowGeneralReport}
        closedProjects={closedProjects}
        onOpenBackupSettings={() => setShowBackupSettings(true)}
      />

      <main className="h-screen flex-1 overflow-y-auto bg-slate-50/50 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          {view === 'create' && (
            <CommunityForm
              key={editingCommunity?.id || 'new-community'}
              mode={editingCommunity ? 'edit' : 'create'}
              initialCommunity={editingCommunity}
              onCancel={() => {
                setEditingCommunityId(null);
                setView('dashboard');
              }}
              onSave={handleSaveCommunity}
            />
          )}

          {view === 'generalReport' && (
            <GeneralReportView
              communities={normalizedCommunities}
              taskResults={taskResults}
              generalObservationsByCommunity={generalObservations}
              deliveryExceptionsByCommunity={deliveryExceptions}
              closedProjectsByCommunity={closedProjects}
              onSelectCommunity={handleCommunityChange}
            />
          )}

          {view === 'dashboard' && !selectedCommunity && (
            <EmptyDashboard onCreateCommunity={handleCreateCommunity} onImportJson={handleTriggerImport} />
          )}

          {view === 'dashboard' && selectedCommunity && (
            <Dashboard
              selectedCommunity={selectedCommunity}
              checklistByPhases={checklistByPhases}
              taskResults={effectiveTaskResults}
              summary={summary}
              finalLabStatus={finalLabStatus}
              commentBoxes={commentBoxes}
              getTaskResult={getTaskResult}
              setTaskStatus={setTaskStatus}
              toggleCommentBox={toggleCommentBox}
              handleCommentChange={handleCommentChange}
              handleEvidenceChange={handleEvidenceChange}
              toggleDeviceAllTasks={toggleDeviceAllTasks}
              deviceNotes={effectiveDeviceNotes}
              onSetDeviceNote={setDeviceNote}
              onClearDeviceNote={clearDeviceNote}
              onShowReport={handleShowReport}
              onResetChecklist={handleResetCurrentChecklist}
              onExportJson={handleExportCurrentJson}
              onEditCommunity={handleEditCommunity}
              onImportJson={handleTriggerImport}
              importStripResults={importStripResults}
              onToggleImportStripResults={setImportStripResults}
              generalObservations={currentGeneralObservations}
              onAddGeneralObservation={handleAddGeneralObservation}
              onUpdateGeneralObservation={handleUpdateGeneralObservation}
              onDeleteGeneralObservation={handleDeleteGeneralObservation}
              deliveryException={currentDeliveryException}
              onSetDeliveryException={handleSetDeliveryException}
              onClearDeliveryException={handleClearDeliveryException}
              onRetryDeliveryExceptionBackup={handleRetryDeliveryExceptionBackup}
              isClosed={isCommunityClosed}
              closedAt={currentClosedProject?.closedAt || null}
              onCloseProject={handleCloseProject}
              onReopenProject={handleReopenProject}
              onArchiveClosedProject={handleArchiveClosedProject}
            />
          )}
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportJson}
      />

      {showReport && selectedCommunity && (
        <ReportModal
          selectedCommunity={selectedCommunity}
          checklistByPhases={checklistByPhases}
          taskResults={effectiveTaskResults}
          summary={summary}
          finalLabStatus={finalLabStatus}
          generalObservations={currentGeneralObservations}
          deliveryException={currentDeliveryException}
          closedProject={currentClosedProject}
          deviceNotes={effectiveDeviceNotes}
          onClose={() => setShowReport(false)}
        />
      )}

      {showBackupSettings && (
        <BackupSettingsModal
          webhookUrl={backupWebhookUrl}
          onSave={setBackupWebhookUrl}
          onClose={() => setShowBackupSettings(false)}
        />
      )}
    </div>
  );
}
