import React from 'react';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  DoorOpen,
  Plus,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  Circle,
  Puzzle,
} from 'lucide-react';
import { DEVICE_CATALOG, PERIPHERALS, OPTIONAL_MODULES } from '../data/deviceCatalog.jsx';
import {
  ACCESS_DIRECTIONS,
  DOOR_TYPES,
  PORT_OPTIONS,
  RELAY_OPTIONS,
  RELAY_SOURCES,
  createDoor,
} from '../constants/accessConfig.js';

const EMPTY_RULES = {
  antipassback: false,
  multivalidation: false,
  multiFactors: [],
};

function createInstanceId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultInstanceLabel(type, index) {
  const deviceName = DEVICE_CATALOG[type]?.name || 'Dispositivo';
  return `${deviceName} #${index + 1}`;
}

function normalizePeripheralConfig(peripheral) {
  const qty = Math.max(1, Number(peripheral.qty) || 1);
  const existingInstances = Array.isArray(peripheral.instances) ? peripheral.instances : [];

  const instances = Array.from({ length: qty }, (_, index) => {
    const existing = existingInstances[index];

    return {
      id: String(existing?.id ?? createInstanceId(peripheral.type)),
      label: existing?.label || getDefaultInstanceLabel(peripheral.type, index),
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
  });

  return {
    ...peripheral,
    qty,
    instances,
  };
}

export default function CommunityForm({
  onCancel,
  onSave,
  initialCommunity = null,
  mode = 'create',
}) {
  const [communityName, setCommunityName] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [installerName, setInstallerName] = useState('');
  const [nodes, setNodes] = useState([]);
  const [selectedPeripheralForNode, setSelectedPeripheralForNode] = useState({});
  const [selectedModules, setSelectedModules] = useState([]);
  const [rules, setRules] = useState(EMPTY_RULES);
  const isEditMode = mode === 'edit' && Boolean(initialCommunity);

  useEffect(() => {
    if (!initialCommunity) {
      setCommunityName('');
      setTechnicianName('');
      setInstallerName('');
      setNodes([]);
      setSelectedPeripheralForNode({});
      setSelectedModules([]);
      setRules(EMPTY_RULES);
      return;
    }

    const copiedNodes = JSON.parse(JSON.stringify(initialCommunity.nodes || [])).map(node => ({
      ...node,
      doors: Array.isArray(node.doors) ? node.doors : [],
      peripherals: (node.peripherals || []).map(normalizePeripheralConfig),
    }));

    const defaultPeripheralSelection = Object.fromEntries(
      copiedNodes.map(node => [node.id, 'qr'])
    );

    setCommunityName(initialCommunity.name || '');
    setTechnicianName(initialCommunity.technicianName || '');
    setInstallerName(initialCommunity.installerName || '');
    setNodes(copiedNodes);
    setSelectedPeripheralForNode(defaultPeripheralSelection);
    setSelectedModules(Array.isArray(initialCommunity.modules) ? initialCommunity.modules : []);
    setRules({
      antipassback: Boolean(initialCommunity.rules?.antipassback),
      multivalidation: Boolean(initialCommunity.rules?.multivalidation),
      multiFactors: initialCommunity.rules?.multiFactors || [],
    });
  }, [initialCommunity]);

  const handleAddNode = () => {
    const newNodeId = `node-${Date.now()}`;

    setNodes(prev => [
      ...prev,
      {
        id: newNodeId,
        type: 'controller',
        label: `Controlador #${prev.length + 1}`,
        doors: [],
        peripherals: [],
      },
    ]);

    setSelectedPeripheralForNode(prev => ({ ...prev, [newNodeId]: 'qr' }));
  };

  const handleUpdateNodeLabel = (nodeId, newLabel) => {
    setNodes(prev => prev.map(node => (
      node.id === nodeId ? { ...node, label: newLabel } : node
    )));
  };

  const handleAddDoor = nodeId => {
    setNodes(prev => prev.map(node => (
      node.id === nodeId ? { ...node, doors: [...(node.doors || []), createDoor()] } : node
    )));
  };

  const handleUpdateDoor = (nodeId, doorId, patch) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;

      return {
        ...node,
        doors: (node.doors || []).map(door => (
          door.id === doorId ? { ...door, ...patch } : door
        )),
      };
    }));
  };

  const handleRemoveDoor = (nodeId, doorId) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;

      return {
        ...node,
        doors: (node.doors || []).filter(door => door.id !== doorId),
        peripherals: (node.peripherals || []).map(peripheral => ({
          ...peripheral,
          instances: (peripheral.instances || []).map(instance => (
            instance.doorId === doorId ? { ...instance, doorId: '', direction: '' } : instance
          )),
        })),
      };
    }));
  };

  const handleUpdateInstanceLink = (nodeId, peripheralType, instanceId, patch) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;

      return {
        ...node,
        peripherals: node.peripherals.map(peripheral => {
          if (peripheral.type !== peripheralType) return peripheral;

          const normalizedPeripheral = normalizePeripheralConfig(peripheral);

          return {
            ...normalizedPeripheral,
            instances: normalizedPeripheral.instances.map(instance => (
              instance.id === instanceId ? { ...instance, ...patch } : instance
            )),
          };
        }),
      };
    }));
  };

  const handleRemoveNode = nodeId => {
    setNodes(prev => prev.filter(node => node.id !== nodeId));
  };

  const handleAddPeripheralToNode = nodeId => {
    const peripheralType = selectedPeripheralForNode[nodeId] || 'qr';

    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;

      const existingPeripheral = node.peripherals.find(
        peripheral => peripheral.type === peripheralType
      );

      if (existingPeripheral) {
        const normalizedPeripheral = normalizePeripheralConfig(existingPeripheral);
        const nextQty = normalizedPeripheral.qty + 1;

        return {
          ...node,
          peripherals: node.peripherals.map(peripheral => {
            if (peripheral.type !== peripheralType) return peripheral;

            return {
              ...normalizedPeripheral,
              qty: nextQty,
              instances: [
                ...normalizedPeripheral.instances,
                {
                  id: createInstanceId(peripheralType),
                  label: getDefaultInstanceLabel(peripheralType, nextQty - 1),
                },
              ],
            };
          }),
        };
      }

      return {
        ...node,
        peripherals: [
          ...node.peripherals,
          {
            type: peripheralType,
            qty: 1,
            instances: [
              {
                id: createInstanceId(peripheralType),
                label: getDefaultInstanceLabel(peripheralType, 0),
              },
            ],
          },
        ],
      };
    }));
  };

  const handleUpdatePeripheralQty = (nodeId, peripheralType, qty) => {
    const parsedQty = Number(qty);
    if (!Number.isFinite(parsedQty) || parsedQty < 1) return;

    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;

      return {
        ...node,
        peripherals: node.peripherals.map(peripheral => {
          if (peripheral.type !== peripheralType) return peripheral;

          const normalizedPeripheral = normalizePeripheralConfig(peripheral);
          const currentInstances = normalizedPeripheral.instances;
          const nextInstances = Array.from({ length: parsedQty }, (_, index) => {
            return currentInstances[index] || {
              id: createInstanceId(peripheralType),
              label: getDefaultInstanceLabel(peripheralType, index),
            };
          });

          return {
            ...normalizedPeripheral,
            qty: parsedQty,
            instances: nextInstances,
          };
        }),
      };
    }));
  };

  const handleUpdatePeripheralInstanceLabel = (nodeId, peripheralType, instanceId, label) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;

      return {
        ...node,
        peripherals: node.peripherals.map(peripheral => {
          if (peripheral.type !== peripheralType) return peripheral;

          const normalizedPeripheral = normalizePeripheralConfig(peripheral);

          return {
            ...normalizedPeripheral,
            instances: normalizedPeripheral.instances.map(instance => (
              instance.id === instanceId ? { ...instance, label } : instance
            )),
          };
        }),
      };
    }));
  };

  const handleRemovePeripheral = (nodeId, peripheralType) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;

      return {
        ...node,
        peripherals: node.peripherals.filter(peripheral => peripheral.type !== peripheralType),
      };
    }));
  };

  const handleToggleMultifactor = peripheralId => {
    setRules(prev => {
      const isSelected = prev.multiFactors.includes(peripheralId);

      return {
        ...prev,
        multiFactors: isSelected
          ? prev.multiFactors.filter(id => id !== peripheralId)
          : [...prev.multiFactors, peripheralId],
      };
    });
  };

  const handleToggleModule = moduleId => {
    setSelectedModules(prev => (
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    ));
  };

  const handleSubmit = () => {
    if (!communityName.trim() || nodes.length === 0) {
      alert('Necesitas un nombre de comunidad y al menos un controlador.');
      return;
    }

    if (rules.multivalidation && rules.multiFactors.length < 2) {
      alert('Para Multivalidación debes seleccionar al menos 2 factores exigidos.');
      return;
    }

    onSave({
      id: initialCommunity?.id,
      name: communityName.trim(),
      technicianName: technicianName.trim(),
      installerName: installerName.trim(),
      nodes: nodes.map(node => ({
        ...node,
        peripherals: (node.peripherals || []).map(normalizePeripheralConfig),
      })),
      modules: selectedModules,
      rules,
    });

    if (!isEditMode) {
      setCommunityName('');
      setTechnicianName('');
      setInstallerName('');
      setNodes([]);
      setSelectedPeripheralForNode({});
      setSelectedModules([]);
      setRules(EMPTY_RULES);
    }
  };

  const knownZones = Array.from(new Set(
    nodes.flatMap(node => (node.doors || []).map(door => door.zone?.trim()).filter(Boolean))
  ));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-6">
        <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
          <Settings2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800">
            {isEditMode ? 'Editar Topología' : 'Configurar Topología'}
          </h2>
          <p className="text-sm text-slate-500">
            {isEditMode
              ? 'Modifica controladores, periféricos, módulos opcionales y reglas de acceso de esta comunidad.'
              : 'Agrega controladores, periféricos, módulos opcionales y reglas para generar el checklist QA.'}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            Nombre de la Comunidad
          </label>
          <input
            type="text"
            value={communityName}
            onChange={event => setCommunityName(event.target.value)}
            placeholder="Ej. Comunidad Scharfstein, Edificio Norte..."
            className="w-full rounded-lg border border-slate-300 p-3 font-medium text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Técnico que configuró/ambientó
            </label>
            <input
              type="text"
              value={technicianName}
              onChange={event => setTechnicianName(event.target.value)}
              placeholder="Nombre del técnico responsable"
              className="w-full rounded-lg border border-slate-300 p-3 font-medium text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Instalador
            </label>
            <input
              type="text"
              value={installerName}
              onChange={event => setInstallerName(event.target.value)}
              placeholder="Nombre del instalador o empresa instaladora"
              className="w-full rounded-lg border border-slate-300 p-3 font-medium text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <label className="block text-sm font-bold text-slate-700">
              Controladores y Periféricos
            </label>
            <button
              type="button"
              onClick={handleAddNode}
              className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
            >
              <Plus className="h-4 w-4" />
              Agregar Controlador
            </button>
          </div>

          {nodes.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center">
              <Server className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">
                Comienza agregando un controlador principal.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {nodes.map(node => (
                <div key={node.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100 p-3">
                    <div className="rounded-md bg-blue-600 p-1.5 text-white">
                      <Server className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      value={node.label}
                      onChange={event => handleUpdateNodeLabel(node.id, event.target.value)}
                      placeholder="Ej. Controlador Puerta Norte"
                      className="flex-1 rounded-md border border-slate-300 bg-white p-1.5 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNode(node.id)}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-red-500"
                      title="Eliminar controlador y sus periféricos"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DoorOpen className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-bold text-slate-700">
                            Puertas de este controlador
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddDoor(node.id)}
                          className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Agregar puerta
                        </button>
                      </div>

                      {(!node.doors || node.doors.length === 0) ? (
                        <p className="text-xs italic text-slate-400">
                          Sin puertas registradas. Agrega al menos una para poder mapear qué dispositivo abre cuál puerta.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {node.doors.map(door => (
                            <div key={door.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="grid gap-2 md:grid-cols-12">
                                <input
                                  type="text"
                                  value={door.name}
                                  onChange={event => handleUpdateDoor(node.id, door.id, { name: event.target.value })}
                                  placeholder="Nombre de la puerta (ej. Acceso Principal)"
                                  className="rounded-md border border-slate-300 bg-white p-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 md:col-span-5"
                                />
                                <input
                                  type="text"
                                  list="qa-labflow-zones"
                                  value={door.zone}
                                  onChange={event => handleUpdateDoor(node.id, door.id, { zone: event.target.value })}
                                  placeholder="Zona"
                                  className="rounded-md border border-slate-300 bg-white p-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 md:col-span-3"
                                />
                                <select
                                  value={door.type}
                                  onChange={event => handleUpdateDoor(node.id, door.id, { type: event.target.value })}
                                  className="rounded-md border border-slate-300 bg-white p-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 md:col-span-3"
                                >
                                  {DOOR_TYPES.map(doorType => (
                                    <option key={doorType.id} value={doorType.id}>{doorType.label}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDoor(node.id, door.id)}
                                  className="flex items-center justify-center rounded-md p-2 text-red-400 transition-colors hover:bg-red-50 md:col-span-1"
                                  title="Eliminar puerta"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mb-4 flex gap-2">
                      <select
                        value={selectedPeripheralForNode[node.id] || 'qr'}
                        onChange={event => setSelectedPeripheralForNode(prev => ({
                          ...prev,
                          [node.id]: event.target.value,
                        }))}
                        className="flex-1 rounded-lg border border-slate-300 bg-white p-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {PERIPHERALS.map(device => (
                          <option key={device.id} value={device.id}>
                            + Agregar {device.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddPeripheralToNode(node.id)}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Conectar
                      </button>
                    </div>

                    {node.peripherals?.length > 0 ? (
                      <div className="space-y-3">
                        {node.peripherals.map(peripheral => {
                          const catalogDevice = DEVICE_CATALOG[peripheral.type];
                          const normalizedPeripheral = normalizePeripheralConfig(peripheral);

                          return (
                            <div key={peripheral.type} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1 text-slate-400">
                                    <ArrowRight className="h-4 w-4" />
                                    {catalogDevice.icon}
                                  </div>
                                  <div>
                                    <span className="text-sm font-bold text-slate-700">
                                      {catalogDevice.name}
                                    </span>
                                    <p className="text-xs text-slate-400">
                                      Nombra cada equipo físico para que el reporte indique exactamente qué acceso se probó.
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <label className="text-xs font-semibold uppercase text-slate-400">
                                    Cant.
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={normalizedPeripheral.qty}
                                    onChange={event => handleUpdatePeripheralQty(node.id, peripheral.type, event.target.value)}
                                    className="w-16 rounded-md border border-slate-200 p-1.5 text-center text-sm font-medium outline-none focus:border-blue-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePeripheral(node.id, peripheral.type)}
                                    className="rounded-md p-1.5 text-red-400 transition-colors hover:bg-red-50"
                                    title="Eliminar este tipo de periférico"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 space-y-3">
                                {normalizedPeripheral.instances.map((instance, index) => (
                                  <div key={instance.id} className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                                    <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-slate-400">
                                      {catalogDevice.name} #{index + 1} - nombre/ubicación
                                    </label>
                                    <input
                                      type="text"
                                      value={instance.label}
                                      onChange={event => handleUpdatePeripheralInstanceLabel(
                                        node.id,
                                        peripheral.type,
                                        instance.id,
                                        event.target.value
                                      )}
                                      placeholder="Ej. Entrada principal, salida vehicular, acceso visitas..."
                                      className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />

                                    <div className="mt-2 grid gap-2 md:grid-cols-4">
                                      <select
                                        value={instance.doorId}
                                        onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, {
                                          doorId: event.target.value,
                                          ...(event.target.value ? {} : { direction: '' }),
                                        })}
                                        className="rounded-md border border-slate-200 bg-white p-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                                      >
                                        <option value="">Sin puerta asignada</option>
                                        {(node.doors || []).map(door => (
                                          <option key={door.id} value={door.id}>
                                            {door.name || 'Puerta sin nombre'}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        value={instance.direction}
                                        disabled={!instance.doorId}
                                        onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, { direction: event.target.value })}
                                        className="rounded-md border border-slate-200 bg-white p-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                      >
                                        <option value="">Sentido...</option>
                                        {ACCESS_DIRECTIONS.map(direction => (
                                          <option key={direction.id} value={direction.id}>{direction.label}</option>
                                        ))}
                                      </select>
                                      <select
                                        value={instance.port}
                                        onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, { port: event.target.value })}
                                        className="rounded-md border border-slate-200 bg-white p-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                                      >
                                        <option value="">Puerto...</option>
                                        {PORT_OPTIONS.map(portOption => (
                                          <option key={portOption.id} value={portOption.id}>{portOption.label}</option>
                                        ))}
                                      </select>
                                      {instance.port === 'OTRO' && (
                                        <input
                                          type="text"
                                          value={instance.portNote}
                                          onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, { portNote: event.target.value })}
                                          placeholder="Detalle del puerto (ej. red/IP)"
                                          className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                                        />
                                      )}
                                      <input
                                        type="text"
                                        value={instance.ip}
                                        onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, { ip: event.target.value })}
                                        placeholder="IP (opcional)"
                                        className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                                      />
                                    </div>

                                    <div className="mt-2 grid gap-2 md:grid-cols-4">
                                      <select
                                        value={instance.relaySource}
                                        onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, { relaySource: event.target.value })}
                                        className="rounded-md border border-slate-200 bg-white p-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                                      >
                                        {RELAY_SOURCES.map(source => (
                                          <option key={source.id} value={source.id}>{source.label}</option>
                                        ))}
                                      </select>
                                      {instance.relaySource === 'controller' ? (
                                        <select
                                          value={instance.relay}
                                          onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, { relay: event.target.value })}
                                          className="rounded-md border border-slate-200 bg-white p-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                                        >
                                          <option value="">Relé...</option>
                                          {RELAY_OPTIONS.map(relay => (
                                            <option key={relay.id} value={relay.id}>{relay.label}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <div className="flex items-center rounded-md border border-dashed border-slate-200 bg-slate-100 p-2 text-xs italic text-slate-400">
                                          Usa el relé propio del dispositivo
                                        </div>
                                      )}
                                      {instance.relaySource === 'controller' && instance.relay === 'OTRO' ? (
                                        <input
                                          type="text"
                                          value={instance.relayNote}
                                          onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, { relayNote: event.target.value })}
                                          placeholder="Detalle (ej. Moxa canal 3)"
                                          className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          value={instance.relayPin}
                                          onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, { relayPin: event.target.value })}
                                          placeholder="Pin/GPIO (opcional)"
                                          disabled={instance.relaySource !== 'controller'}
                                          className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                      )}
                                      <input
                                        type="number"
                                        min="0"
                                        value={instance.actionSeconds}
                                        onChange={event => handleUpdateInstanceLink(node.id, peripheral.type, instance.id, { actionSeconds: event.target.value })}
                                        placeholder="Segundos de apertura"
                                        className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pl-2 text-xs italic text-slate-400">
                        <ArrowRight className="h-3 w-3" />
                        Sin periféricos conectados a este controlador.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <datalist id="qa-labflow-zones">
            {knownZones.map(zone => <option key={zone} value={zone} />)}
          </datalist>
        </div>

        <div className="pt-4">
          <div className="mb-4 flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-slate-700" />
            <label className="block text-sm font-bold text-slate-700">
              Módulos Opcionales de Acceso
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-medium leading-5 text-slate-500">
              Selecciona solo los módulos que realmente usa la comunidad. Si no usa invitaciones o carnet, no se agregan al checklist ni al PDF.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {OPTIONAL_MODULES.map(module => {
                const isSelected = selectedModules.includes(module.id);

                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => handleToggleModule(module.id)}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className={`mt-0.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                      {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {module.icon}
                        <h4 className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                          {module.name}
                        </h4>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Agrega {module.tests.length} pruebas específicas al checklist.
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-4">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-700" />
            <label className="block text-sm font-bold text-slate-700">
              Reglas de Acceso Avanzadas
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setRules(prev => ({ ...prev, antipassback: !prev.antipassback }))}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                rules.antipassback
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`mt-0.5 ${rules.antipassback ? 'text-blue-600' : 'text-slate-400'}`}>
                {rules.antipassback ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </div>
              <div>
                <h4 className={`text-sm font-bold ${rules.antipassback ? 'text-blue-900' : 'text-slate-700'}`}>
                  Anti-Passback
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Inyecta pruebas de doble entrada/salida en periféricos de acceso.
                </p>
              </div>
            </button>

            <div className={`rounded-xl border-2 p-4 transition-colors ${
              rules.multivalidation
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}>
              <button
                type="button"
                onClick={() => setRules(prev => ({ ...prev, multivalidation: !prev.multivalidation }))}
                className="flex w-full items-start gap-3 text-left"
              >
                <div className={`mt-0.5 ${rules.multivalidation ? 'text-blue-600' : 'text-slate-400'}`}>
                  {rules.multivalidation ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${rules.multivalidation ? 'text-blue-900' : 'text-slate-700'}`}>
                    Multivalidación
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Exige múltiples factores y agrega pruebas a dichos equipos.
                  </p>
                </div>
              </button>

              {rules.multivalidation && (
                <div className="mt-4 border-t border-blue-100 pt-3">
                  <label className="mb-2 block text-xs font-bold text-blue-800">
                    Selecciona los equipos involucrados en la cadena:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PERIPHERALS.map(peripheral => {
                      const isSelected = rules.multiFactors.includes(peripheral.id);

                      return (
                        <button
                          key={peripheral.id}
                          type="button"
                          onClick={() => handleToggleMultifactor(peripheral.id)}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600 ring-offset-1'
                              : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {peripheral.icon}
                          {peripheral.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            {isEditMode ? 'Guardar cambios' : 'Generar Flujo'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
