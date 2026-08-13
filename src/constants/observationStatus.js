export const OBSERVATION_STATUS = {
  pending: {
    label: 'Pendiente',
    badge: 'border-amber-300 bg-amber-50 text-amber-700',
  },
  in_review: {
    label: 'En revisión',
    badge: 'border-indigo-300 bg-indigo-50 text-indigo-700',
  },
  resolved: {
    label: 'Resuelta',
    badge: 'border-green-300 bg-green-50 text-green-700',
  },
};

export const OBSERVATION_STATUS_ORDER = ['pending', 'in_review', 'resolved'];

// Compatibilidad con observaciones guardadas antes de que existiera el
// estado "En revisión", cuando solo había un booleano `resolved`.
export function resolveObservationStatus(observation) {
  if (observation?.status && OBSERVATION_STATUS[observation.status]) {
    return observation.status;
  }
  return observation?.resolved ? 'resolved' : 'pending';
}
