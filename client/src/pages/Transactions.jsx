import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import Toast from '../components/Toast.jsx';

function fmt(n) {
  return Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyForm = { account_id: '', type: 'EXPENSE', amount: '', date: new Date().toISOString().slice(0, 10), description: '', metadata: '' };

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts]         = useState([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const LIMIT = 15;

  const [filters, setFilters] = useState({ type: '', account_id: '', from: '', to: '' });
  const [form, setForm]       = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast]     = useState(null);

  const loadAccounts = async () => {
    try { setAccounts(await api.getAccounts()); } catch {}
  };

  const loadTx = useCallback(async () => {
    const params = { page, limit: LIMIT, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    try {
      const res = await api.getTransactions(params);
      setTransactions(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
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
      metadata: tx.metadata ? JSON.stringify(tx.metadata, null, 2) : '',
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
      account_id: Number(form.account_id),
      type: form.type,
      amount: Number(form.amount),
      date: form.date,
      description: form.description.trim() || null,
      metadata: form.metadata.trim() ? JSON.parse(form.metadata) : null,
    };
    try {
      if (editing) {
        await api.updateTransaction(editing, payload);
        setToast({ message: 'Transacción actualizada', type: 'info' });
      } else {
        await api.createTransaction(payload);
        setToast({ message: 'Transacción registrada', type: 'info' });
      }
      cancelForm();
      setPage(1);
      await loadTx();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
      await api.deleteTransaction(id);
      setToast({ message: 'Transacción eliminada', type: 'info' });
      await loadTx();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <h1>Transacciones</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva</button>
      </div>

      {showForm && (
        <div className="section" style={{ marginBottom: 16 }}>
          <h3>{editing ? 'Editar transacción' : 'Nueva transacción'}</h3>
          <form className="form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Cuenta</label>
                <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} required>
                  <option value="">Seleccionar...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Egreso</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Monto (S/)</label>
                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Opcional" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary">{editing ? 'Guardar' : 'Registrar'}</button>
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="filters">
        <div className="form-group" style={{ minWidth: 120 }}>
          <label>Tipo</label>
          <select value={filters.type} onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}>
            <option value="">Todos</option>
            <option value="INCOME">Ingresos</option>
            <option value="EXPENSE">Egresos</option>
          </select>
        </div>
        <div className="form-group" style={{ minWidth: 140 }}>
          <label>Cuenta</label>
          <select value={filters.account_id} onChange={e => { setFilters(f => ({ ...f, account_id: e.target.value })); setPage(1); }}>
            <option value="">Todas</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Desde</label>
          <input type="date" value={filters.from} onChange={e => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1); }} />
        </div>
        <div className="form-group">
          <label>Hasta</label>
          <input type="date" value={filters.to} onChange={e => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1); }} />
        </div>
        {(filters.type || filters.account_id || filters.from || filters.to) && (
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-end' }} onClick={() => { setFilters({ type: '', account_id: '', from: '', to: '' }); setPage(1); }}>
            Limpiar
          </button>
        )}
      </div>

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Cuenta</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'right' }}>Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Sin transacciones</td></tr>
            ) : transactions.map(tx => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.description || '—'}</td>
                <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: tx.account_color, display: 'inline-block', flexShrink: 0 }} />
                  {tx.account_name}
                </td>
                <td><span className={`badge badge-${tx.type === 'INCOME' ? 'income' : 'expense'}`}>{tx.type === 'INCOME' ? 'Ingreso' : 'Egreso'}</span></td>
                <td style={{ textAlign: 'right' }} className={tx.type === 'INCOME' ? 'positive' : 'negative'}>
                  {tx.type === 'INCOME' ? '+' : '-'}S/ {fmt(tx.amount)}
                </td>
                <td style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => startEdit(tx)}>Editar</button>
                  <button className="btn btn-danger"  style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleDelete(tx.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Anterior</button>
            <span style={{ padding: '8px 4px', fontSize: 13, color: 'var(--text-muted)' }}>{page} / {pages}</span>
            <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Siguiente ›</button>
          </div>
        )}
      </div>
    </div>
  );
}
