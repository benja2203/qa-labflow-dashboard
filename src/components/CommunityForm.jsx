import React from 'react';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
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
  const [nodes, setNodes] = useState([]);
  const [selectedPeripheralForNode, setSelectedPeripheralForNode] = useState({});
  const [selectedModules, setSelectedModules] = useState([]);
  const [rules, setRules] = useState(EMPTY_RULES);
  const isEditMode = mode === 'edit' && Boolean(initialCommunity);

  useEffect(() => {
    if (!initialCommunity) {
      setCommunityName('');
      setNodes([]);
      setSelectedPeripheralForNode({});
      setSelectedModules([]);
      setRules(EMPTY_RULES);
      return;
    }

    const copiedNodes = JSON.parse(JSON.stringify(initialCommunity.nodes || [])).map(node => ({
      ...node,
      peripherals: (node.peripherals || []).map(normalizePeripheralConfig),
    }));

    const defaultPeripheralSelection = Object.fromEntries(
      copiedNodes.map(node => [node.id, 'qr'])
    );

    setCommunityName(initialCommunity.name || '');
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
      nodes: nodes.map(node => ({
        ...node,
        peripherals: (node.peripherals || []).map(normalizePeripheralConfig),
      })),
      modules: selectedModules,
      rules,
    });

    if (!isEditMode) {
      setCommunityName('');
      setNodes([]);
      setSelectedPeripheralForNode({});
      setSelectedModules([]);
      setRules(EMPTY_RULES);
    }
  };

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

                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                {normalizedPeripheral.instances.map((instance, index) => (
                                  <div key={instance.id}>
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
                                      className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                                    />
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
