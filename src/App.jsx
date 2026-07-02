import React from 'react';
import { useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Upload } from 'lucide-react';
import { INITIAL_COMMUNITIES } from './data/deviceCatalog.jsx';
import { DEFAULT_TASK_RESULT } from './constants/testStatus.js';
import { DEFAULT_INSTANCE_LINK } from './constants/accessConfig.js';
import { useLocalStorageState } from './hooks/useLocalStorageState.js';
import { buildChecklistByPhases } from './utils/checklist.js';
import {
  buildReportPayload,
  createChecklistSummary,
  getChecklistTaskIds,
  getFinalLabStatus,
  getTaskResult as readTaskResult,
  hasChecklistFailuresWithoutComment,
} from './utils/report.js';
import Sidebar from './components/Sidebar.jsx';
import CommunityForm from './components/CommunityForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import ReportModal from './components/ReportModal.jsx';



const LEGACY_CONTROLLER_TYPE = ['mod', 'berry'].join('');
const LEGACY_CONTROLLER_LABEL = new RegExp(['mod', 'berry'].join(''), 'gi');

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
        relay: existing?.relay || '',
        relayNote: existing?.relayNote || '',
        relayPin: existing?.relayPin || '',
        actionSeconds: existing?.actionSeconds || '',
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

  return {
    ...community,
    technicianName: community.technicianName || '',
    installerName: community.installerName || '',
    modules: Array.isArray(community.modules)
      ? community.modules
      : Array.isArray(community.enabledModules)
        ? community.enabledModules
        : [],
    nodes: (community.nodes || []).map(node => ({
      ...node,
      type: node.type === LEGACY_CONTROLLER_TYPE ? 'controller' : node.type,
      label: String(node.label || '').replace(LEGACY_CONTROLLER_LABEL, 'Controlador'),
      doors: Array.isArray(node.doors) ? node.doors.map(normalizeDoor) : [],
      peripherals: (node.peripherals || []).map(normalizePeripheralConfig),
    })),
  };
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

  return { community, taskResults };
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

  const [commentBoxes, setCommentBoxes] = useState({});
  const [showReport, setShowReport] = useState(false);
  const [view, setView] = useState('dashboard');
  const [editingCommunityId, setEditingCommunityId] = useState(null);
  const [importStripResults, setImportStripResults] = useState(false);
  const fileInputRef = React.useRef(null);

  const normalizedCommunities = useMemo(() => {
    return communities.map(normalizeCommunity);
  }, [communities]);

  const selectedCommunity = useMemo(() => {
    return normalizedCommunities.find(community => community.id === selectedCommunityId) || normalizedCommunities[0] || null;
  }, [normalizedCommunities, selectedCommunityId]);

  const editingCommunity = useMemo(() => {
    if (!editingCommunityId) return null;
    return normalizedCommunities.find(community => community.id === editingCommunityId) || null;
  }, [normalizedCommunities, editingCommunityId]);

  const checklistByPhases = useMemo(() => {
    return buildChecklistByPhases(selectedCommunity);
  }, [selectedCommunity]);

  const summary = useMemo(() => {
    return createChecklistSummary(checklistByPhases, taskResults);
  }, [checklistByPhases, taskResults]);

  const finalLabStatus = useMemo(() => getFinalLabStatus(summary), [summary]);

  const getTaskResult = taskId => readTaskResult(taskResults, taskId);

  const updateTaskResult = (taskId, patch) => {
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

  const toggleDeviceAllTasks = (tasks, isComplete) => {
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

  const handleEditCommunity = () => {
    if (!selectedCommunity) return;
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

    setCommentBoxes({});
    setShowReport(false);
  };

  const handleResetCurrentChecklist = () => {
    if (!selectedCommunity) return;

    const confirmed = window.confirm(`¿Reiniciar el checklist de "${selectedCommunity.name}"? Se borrarán estados, comentarios y evidencia de esta comunidad.`);
    if (!confirmed) return;

    const taskIds = new Set(getChecklistTaskIds(checklistByPhases));

    setTaskResults(prev => Object.fromEntries(
      Object.entries(prev).filter(([taskId]) => !taskIds.has(taskId))
    ));

    setCommentBoxes({});
    setShowReport(false);
  };

  const handleExportCurrentJson = () => {
    if (!selectedCommunity) return;

    const payload = buildReportPayload({
      selectedCommunity,
      checklistByPhases,
      taskResults,
      summary,
      finalLabStatus,
    });

    const filename = `qa-labflow-${sanitizeFilename(selectedCommunity.name)}-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(filename, payload);
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
      const { community, taskResults: parsedResults } = parseImportedPayload(reader.result);
      const importedResults = importStripResults ? {} : parsedResults;
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

      setCommunities(prev => [...prev, communityToAdd]);
      setTaskResults(prev => ({ ...prev, ...remappedResults }));
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
    if (hasChecklistFailuresWithoutComment(checklistByPhases, taskResults)) {
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

          {view === 'dashboard' && !selectedCommunity && (
            <EmptyDashboard onCreateCommunity={handleCreateCommunity} onImportJson={handleTriggerImport} />
          )}

          {view === 'dashboard' && selectedCommunity && (
            <Dashboard
              selectedCommunity={selectedCommunity}
              checklistByPhases={checklistByPhases}
              taskResults={taskResults}
              summary={summary}
              finalLabStatus={finalLabStatus}
              commentBoxes={commentBoxes}
              getTaskResult={getTaskResult}
              setTaskStatus={setTaskStatus}
              toggleCommentBox={toggleCommentBox}
              handleCommentChange={handleCommentChange}
              handleEvidenceChange={handleEvidenceChange}
              toggleDeviceAllTasks={toggleDeviceAllTasks}
              onShowReport={handleShowReport}
              onResetChecklist={handleResetCurrentChecklist}
              onExportJson={handleExportCurrentJson}
              onEditCommunity={handleEditCommunity}
              onImportJson={handleTriggerImport}
              importStripResults={importStripResults}
              onToggleImportStripResults={setImportStripResults}
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
          taskResults={taskResults}
          summary={summary}
          finalLabStatus={finalLabStatus}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
