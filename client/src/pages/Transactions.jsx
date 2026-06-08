import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import Toast from '../components/Toast.jsx';

function fmt(n) {
  return Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyForm = {
  account_id: '',
  type: 'EXPENSE',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  description: '',
};

const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts]         = useState([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const LIMIT = 15;

  const [filters, setFilters]     = useState({ type: '', account_id: '', from: '', to: '' });
  const [form, setForm]           = useState(emptyForm);
  const [editing, setEditing]     = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [toast, setToast]         = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading]     = useState(true);

  const loadAccounts = async () => {
    try { setAccounts(await api.getAccounts()); } catch {}
  };

  const loadTx = useCallback(async () => {
    setLoading(true);
    const params = { page, limit: LIMIT, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    try {
      const res = await api.getTransactions(params);
      setTransactions(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadTx(); }, [loadTx]);

  function startEdit(tx) {
    setEditing(tx.id);
    setForm({
      account_id: String(tx.account_id),
      type: tx.type,
      amount: String(tx.amount),
      date: tx.date,
      description: tx.description ?? '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setEditing(null);
    setForm({ ...emptyForm, account_id: accounts[0]?.id ? String(accounts[0].id) : '' });
    setShowForm(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm, account_id: accounts[0]?.id ? String(accounts[0].id) : '' });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      account_id:  Number(form.account_id),
      type:        form.type,
      amount:      Number(form.amount),
      date:        form.date,
      description: form.description.trim() || null,
    };
    try {
      if (editing) {
        await api.updateTransaction(editing, payload);
        setToast({ message: 'Transacción actualizada' });
      } else {
        await api.createTransaction(payload);
        setToast({ message: 'Transacción registrada' });
      }
      cancelForm();
      setPage(1);
      await loadTx();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleDelete(id) {
    setDeletingId(null);
    try {
      await api.deleteTransaction(id);
      setToast({ message: 'Transacción eliminada' });
      await loadTx();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  const pages = Math.ceil(total / LIMIT);
  const hasFilters = filters.type || filters.account_id || filters.from || filters.to;

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Slide-over form panel */}
      {showForm && (
        <div className="modal-backdrop" onClick={cancelForm}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">
                {editing ? 'Editar transacción' : 'Nueva transacción'}
              </span>
              <button className="modal-close-btn" onClick={cancelForm} aria-label="Cerrar">
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <form id="tx-form" onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Cuenta</label>
                      <select
                        className="form-select"
                        value={form.account_id}
                        onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                        required
                      >
                        <option value="">Seleccionar...</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipo</label>
                      <select
                        className="form-select"
                        value={form.type}
                        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      >
                        <option value="INCOME">Ingreso</option>
                        <option value="EXPENSE">Egreso</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Monto (S/)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.amount}
                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fecha</label>
                      <input
                        className="form-input"
                        type="date"
                        value={form.date}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <input
                      className="form-input"
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-foot">
              <button type="submit" form="tx-form" className="btn btn-primary">
                {editing ? 'Guardar cambios' : 'Registrar'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Transacciones</h1>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="form-group" style={{ minWidth: 120 }}>
          <label className="form-label">Tipo</label>
          <select className="form-select" value={filters.type}
            onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}>
            <option value="">Todos</option>
            <option value="INCOME">Ingresos</option>
            <option value="EXPENSE">Egresos</option>
          </select>
        </div>
        <div className="form-group" style={{ minWidth: 140 }}>
          <label className="form-label">Cuenta</label>
          <select className="form-select" value={filters.account_id}
            onChange={e => { setFilters(f => ({ ...f, account_id: e.target.value })); setPage(1); }}>
            <option value="">Todas</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Desde</label>
          <input className="form-input" type="date" value={filters.from}
            onChange={e => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1); }} />
        </div>
        <div className="form-group">
          <label className="form-label">Hasta</label>
          <input className="form-input" type="date" value={filters.to}
            onChange={e => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1); }} />
        </div>
        {hasFilters && (
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <label className="form-label" style={{ opacity: 0 }}>_</label>
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setFilters({ type: '', account_id: '', from: '', to: '' }); setPage(1); }}>
              Limpiar
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Cuenta</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="loading-rows">
                  <td colSpan={6}>Cargando...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                      </svg>
                      <div className="empty-title">Sin transacciones</div>
                      <div className="empty-body">
                        {hasFilters ? 'Ninguna coincide con los filtros.' : 'Registra tu primera transacción.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : transactions.map(tx => (
                <tr key={tx.id} className={deletingId === tx.id ? 'row-confirming' : ''}>
                  <td className="text-muted text-sm mono" style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                  <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.description || <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <span className="acct-cell">
                      <span className="acct-dot" style={{ background: tx.account_color }} />
                      {tx.account_name}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${tx.type === 'INCOME' ? 'income' : 'expense'}`}>
                      {tx.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`amount ${tx.type === 'INCOME' ? 'positive' : 'negative'}`}>
                      {tx.type === 'INCOME' ? '+' : '−'}S/ {fmt(tx.amount)}
                    </span>
                  </td>
                  <td>
                    {deletingId === tx.id ? (
                      <div className="inline-confirm">
                        <span className="inline-confirm-label">¿Eliminar?</span>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(tx.id)}>Sí</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setDeletingId(null)}>No</button>
                      </div>
                    ) : (
                      <div className="table-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => startEdit(tx)}>Editar</button>
                        <button className="btn btn-sm btn-danger-soft" onClick={() => setDeletingId(tx.id)}>Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de {total}
            </span>
            <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              ‹ Anterior
            </button>
            <span className="text-muted text-sm">{page} / {pages}</span>
            <button className="btn btn-sm btn-ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
              Siguiente ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
