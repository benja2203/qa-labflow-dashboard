export const TEST_STATUS = {
  pending: {
    label: 'Pendiente',
    shortLabel: 'Pending',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    text: 'text-slate-600',
  },
  pass: {
    label: 'Pass',
    shortLabel: 'Pass',
    badge: 'bg-green-100 text-green-700 border-green-200',
    text: 'text-green-700',
  },
  fail: {
    label: 'Fail',
    shortLabel: 'Fail',
    badge: 'bg-red-100 text-red-700 border-red-200',
    text: 'text-red-700',
  },
  blocked: {
    label: 'Blocked',
    shortLabel: 'Blocked',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    text: 'text-yellow-700',
  },
  na: {
    label: 'N/A',
    shortLabel: 'N/A',
    badge: 'bg-slate-200 text-slate-500 border-slate-300',
    text: 'text-slate-500',
  },
};

export const TEST_STATUS_ORDER = ['pending', 'pass', 'fail', 'blocked', 'na'];

export const DEFAULT_TASK_RESULT = {
  status: 'pending',
  comment: '',
  evidence: '',
  updatedAt: '',
};
