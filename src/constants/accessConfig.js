export const DOOR_TYPES = [
  { id: 'peatonal', label: 'Peatonal' },
  { id: 'vehicular', label: 'Vehicular' },
  { id: 'torniquete', label: 'Torniquete' },
  { id: 'barrera', label: 'Barrera' },
  { id: 'porton', label: 'Portón' },
  { id: 'perimetral', label: 'Perimetral' },
];

export const ACCESS_DIRECTIONS = [
  { id: 'entrada', label: 'Entrada' },
  { id: 'salida', label: 'Salida' },
  { id: 'bidireccional', label: 'Bidireccional' },
];

export const RELAY_OPTIONS = [
  { id: 'R1', label: 'R1' },
  { id: 'R2', label: 'R2' },
  { id: 'R3', label: 'R3' },
  { id: 'R4', label: 'R4' },
  { id: 'R5', label: 'R5' },
  { id: 'R6', label: 'R6' },
  { id: 'R7', label: 'R7' },
  { id: 'R8', label: 'R8' },
  { id: 'OTRO', label: 'Otro (ej. Moxa)' },
];

export const RELAY_SOURCES = [
  { id: 'controller', label: 'Relé del controlador' },
  { id: 'device', label: 'Relé integrado en el dispositivo' },
];

export const PORT_OPTIONS = [
  { id: 'COM1', label: 'COM1' },
  { id: 'COM2', label: 'COM2' },
  { id: 'COM3', label: 'COM3' },
  { id: 'COM4', label: 'COM4' },
  { id: 'COM5', label: 'COM5' },
  { id: 'COM6', label: 'COM6' },
  { id: 'COM7', label: 'COM7' },
  { id: 'COM8', label: 'COM8' },
  { id: 'OTRO', label: 'Otro / red (IP)' },
];

export function getDoorTypeLabel(typeId) {
  return DOOR_TYPES.find(type => type.id === typeId)?.label || typeId || '';
}

export function getDirectionLabel(directionId) {
  return ACCESS_DIRECTIONS.find(direction => direction.id === directionId)?.label || '';
}

export function getRelayLabel(relayId) {
  return RELAY_OPTIONS.find(relay => relay.id === relayId)?.label || relayId || '';
}

export function getRelaySourceLabel(sourceId) {
  return RELAY_SOURCES.find(source => source.id === sourceId)?.label || '';
}

export function getPortLabel(portId, portNote) {
  if (portId === 'OTRO') return portNote?.trim() || 'Otro puerto';
  return PORT_OPTIONS.find(port => port.id === portId)?.label || portId || '';
}

export function createDoor() {
  return {
    id: `door-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    zone: '',
    type: 'peatonal',
  };
}

export const DEFAULT_INSTANCE_LINK = {
  doorId: '',
  direction: '',
  port: '',
  portNote: '',
  ip: '',
  relaySource: 'controller',
  relay: '',
  relayNote: '',
  relayPin: '',
  actionSeconds: '',
};
