const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error ?? 'Error desconocido');
  }
  return res.json();
}

const get  = (path)        => request(path);
const post = (path, body)  => request(path, { method: 'POST',  body: JSON.stringify(body) });
const patch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) });
const del  = (path)        => request(path, { method: 'DELETE' });

export const api = {
  getAccounts:       ()         => get('/accounts'),
  createAccount:     (data)     => post('/accounts', data),
  updateAccount:     (id, data) => patch(`/accounts/${id}`, data),
  deleteAccount:     (id)       => del(`/accounts/${id}`),

  getTransactions:   (params)   => get(`/transactions?${new URLSearchParams(params ?? {})}`),
  createTransaction: (data)     => post('/transactions', data),
  updateTransaction: (id, data) => patch(`/transactions/${id}`, data),
  deleteTransaction: (id)       => del(`/transactions/${id}`),

  getTransfers:      ()         => get('/transfers'),
  createTransfer:    (data)     => post('/transfers', data),
  updateTransfer:    (id, data) => patch(`/transfers/${id}`, data),
  deleteTransfer:    (id)       => del(`/transfers/${id}`),

  getSummary:        (params)   => get(`/summary?${new URLSearchParams(params ?? {})}`),
  getDistribution:   (params)   => get(`/summary/distribution?${new URLSearchParams(params ?? {})}`),
  getTimeline:       (params)   => get(`/summary/timeline?${new URLSearchParams(params ?? {})}`),

  getNotes:          ()         => get('/notes'),
  createNote:        (data)     => post('/notes', data),
  updateNote:        (id, data) => patch(`/notes/${id}`, data),
  deleteNote:        (id)       => del(`/notes/${id}`),

  getSettings:        ()     => get('/settings'),
  updateSettings:     (data) => patch('/settings', data),

  getServerInfo: () => get('/server-info'),

  getArchivedAccounts: ()   => get('/accounts/archived'),
  restoreAccount:      (id) => post(`/accounts/${id}/restore`),

  exportData: ()     => get('/data/export'),
  importData: (data) => post('/data/import', data),
  wipeData:   ()     => post('/data/wipe', { confirm: true }),

  getTags: () => get('/transactions/tags'),

  getAccountTypes:   ()         => get('/account-types'),
  createAccountType: (data)     => post('/account-types', data),
  updateAccountType: (id, data) => patch(`/account-types/${id}`, data),
  deleteAccountType: (id, reassign_to) =>
    request(`/account-types/${id}`, { method: 'DELETE', body: JSON.stringify({ reassign_to }) }),

  getCategories:   ()         => get('/categories'),
  createCategory:  (data)     => post('/categories', data),
  updateCategory:  (id, data) => patch(`/categories/${id}`, data),
  deleteCategory:  (id, reassign_to) =>
    request(`/categories/${id}`, { method: 'DELETE', body: JSON.stringify({ reassign_to }) }),

  getCustomFields:   ()         => get('/custom-fields'),
  createCustomField: (data)     => post('/custom-fields', data),
  updateCustomField: (id, data) => patch(`/custom-fields/${id}`, data),
  deleteCustomField: (id)       => del(`/custom-fields/${id}`),

  getDebts:   ()         => get('/debts'),
  getDebt:    (id)       => get(`/debts/${id}`),
  createDebt: (data)     => post('/debts', data),
  updateDebt: (id, data) => patch(`/debts/${id}`, data),
  deleteDebt: (id)       => del(`/debts/${id}`),

  createDebtPayment: (debtId, data)            => post(`/debts/${debtId}/payments`, data),
  updateDebtPayment: (debtId, paymentId, data) => patch(`/debts/${debtId}/payments/${paymentId}`, data),
  deleteDebtPayment: (debtId, paymentId)       => del(`/debts/${debtId}/payments/${paymentId}`),

  getDebtTypes:   ()         => get('/debt-types'),
  createDebtType: (data)     => post('/debt-types', data),
  updateDebtType: (id, data) => patch(`/debt-types/${id}`, data),
  deleteDebtType: (id, reassign_to) =>
    request(`/debt-types/${id}`, { method: 'DELETE', body: JSON.stringify({ reassign_to }) }),
};
