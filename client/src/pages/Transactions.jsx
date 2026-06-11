import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { fmtMoney, fmtDate } from '../format.js';
import { categoriesFor, categoryInfo, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../categories.js';
import { IconPlus, IconClose, IconEdit, IconTrash, IconSearch } from '../components/Icons.jsx';
import { useSettings } from '../settings-context.jsx';
import Toast from '../components/Toast.jsx';

const emptyForm = {
  account_id: '',
  type: 'EXPENSE',
  category: 'otros',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  description: '',
};

const emptyFilters = { type: '', account_id: '', category: '', from: '', to: '' };

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PRESETS = [
  { id: 'hoy', label: 'Hoy', range: () => {
    const t = toDateStr(new Date());
    return { from: t, to: t };
  } },
  { id: 'semana', label: 'Esta semana', range: () => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // lunes = 0
    const from = new Date(now); from.setDate(now.getDate() - day);
    return { from: toDateStr(from), to: toDateStr(now) };
  } },
  { id: 'mes', label: 'Este mes', range: () => {
    const now = new Date();
    return { from: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateStr(now) };
  } },
  { id: 'año', label: 'Este año', range: () => {
    const now = new Date();
    return { from: toDateStr(new Date(now.getFullYear(), 0, 1)), to: toDateStr(now) };
  } },
];

export default function Transactions() {
  const { settings } = useSettings();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts]         = useState([]);
  const [total, setTotal]               = useState(0);
  const [totals, setTotals]             = useState([]);
  const [page, setPage]                 = useState(1);
  const LIMIT = settings.page_size;

  const [filters, setFilters]     = useState(emptyFilters);
  const [search, setSearch]       = useState('');
  const [q, setQ]                 = useState('');
  const [form, setForm]           = useState(emptyForm);
  const [editing, setEditing]     = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading]     = useState(true);

  const loadAccounts = async () => {
    try { setAccounts(await api.getAccounts()); } catch {}
  };

  const loadTx = useCallback(async () => {
    setLoading(true);
    const active = Object.fromEntries(Object.entries({ ...filters, q }).filter(([, v]) => v));
    try {
      const res = await api.getTransactions({ page, limit: LIMIT, ...active });
      setTransactions(res.data ?? []);
      setTotal(res.total ?? 0);
      setTotals(res.totals ?? []);
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
    setLoading(false);
  }, [page, filters, q, LIMIT]);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadTx(); }, [loadTx]);

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!showForm) return;
    const onKey = e => { if (e.key === 'Escape') cancelForm(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const selectedAccount = accounts.find(a => String(a.id) === form.account_id);

  function setFilter(patch) {
    setFilters(f => ({ ...f, ...patch }));
    setPage(1);
  }

  function startEdit(tx) {
    setEditing(tx.id);
    setForm({
      account_id: String(tx.account_id),
      type: tx.type,
      category: tx.category ?? 'otros',
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
    if (saving) return;
    setSaving(true);
    const payload = {
      account_id:  Number(form.account_id),
      type:        form.type,
      category:    form.category,
      amount:      Number(form.amount),
      date:        form.date,
      description: form.description.trim(),
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
    setSaving(false);
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
  const hasFilters = q || Object.values(filters).some(v => v);
  const filterCategories = filters.type === 'INCOME'
    ? INCOME_CATEGORIES
    : filters.type === 'EXPENSE'
      ? EXPENSE_CATEGORIES
      : [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES.filter(c => c.id !== 'otros')];

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
                <IconClose />
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
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipo</label>
                      <select
                        className="form-select"
                        value={form.type}
                        onChange={e => setForm(f => ({ ...f, type: e.target.value, category: 'otros' }))}
                      >
                        <option value="INCOME">Ingreso</option>
                        <option value="EXPENSE">Egreso</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <select
                      className="form-select"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {categoriesFor(form.type).map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        Monto{selectedAccount ? ` (${selectedAccount.currency})` : ''}
                      </label>
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
              <button type="submit" form="tx-form" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Transacciones</h1>
          <p className="page-sub">Tus ingresos y egresos, con filtros y búsqueda</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <IconPlus />
          Nueva
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="form-group" style={{ flex: '1 1 180px', minWidth: 160 }}>
          <label className="form-label">Buscar</label>
          <div className="search-box">
            <IconSearch />
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por descripción..."
            />
          </div>
        </div>
        <div className="form-group" style={{ minWidth: 110 }}>
          <label className="form-label">Tipo</label>
          <select className="form-select" value={filters.type}
            onChange={e => setFilter({ type: e.target.value, category: '' })}>
            <option value="">Todos</option>
            <option value="INCOME">Ingresos</option>
            <option value="EXPENSE">Egresos</option>
          </select>
        </div>
        <div className="form-group" style={{ minWidth: 130 }}>
          <label className="form-label">Categoría</label>
          <select className="form-select" value={filters.category}
            onChange={e => setFilter({ category: e.target.value })}>
            <option value="">Todas</option>
            {filterCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ minWidth: 130 }}>
          <label className="form-label">Cuenta</label>
          <select className="form-select" value={filters.account_id}
            onChange={e => setFilter({ account_id: e.target.value })}>
            <option value="">Todas</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Desde</label>
          <input className="form-input" type="date" value={filters.from}
            onChange={e => setFilter({ from: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Hasta</label>
          <input className="form-input" type="date" value={filters.to}
            onChange={e => setFilter({ to: e.target.value })} />
        </div>
      </div>

      <div className="presets-bar">
        {PRESETS.map(p => {
          const r = p.range();
          const active = filters.from === r.from && filters.to === r.to;
          return (
            <button
              key={p.id}
              className={`chip${active ? ' active' : ''}`}
              onClick={() => setFilter(active ? { from: '', to: '' } : r)}
            >
              {p.label}
            </button>
          );
        })}
        {hasFilters && (
          <button className="chip clear"
            onClick={() => { setFilters(emptyFilters); setSearch(''); setQ(''); setPage(1); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Movimientos {total > 0 && <span className="card-count">{total}</span>}
          </span>
          {totals.length > 0 && (
            <div className="totals-inline">
              {totals.map(t => (
                <div className="totals-group" key={t.currency}>
                  <span className="totals-item positive">+{fmtMoney(t.income, t.currency)}</span>
                  <span className="totals-item negative">−{fmtMoney(t.expenses, t.currency)}</span>
                  <span className="totals-item net">= {fmtMoney(t.income - t.expenses, t.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Cuenta</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th></th>
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
              ) : transactions.map(tx => {
                const cat = categoryInfo(tx.category);
                return (
                  <tr key={tx.id} className={deletingId === tx.id ? 'row-confirming' : ''}>
                    <td className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description || <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className="cat-cell">
                        <span className="acct-dot" style={{ background: cat.color }} />
                        {cat.label}
                      </span>
                    </td>
                    <td>
                      <span className="acct-cell">
                        <span className="acct-dot" style={{ background: tx.account_color }} />
                        {tx.account_name}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`amount ${tx.type === 'INCOME' ? 'positive' : 'negative'}`}>
                        {tx.type === 'INCOME' ? '+' : '−'}{fmtMoney(tx.amount, tx.account_currency)}
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
                          <button className="icon-btn" onClick={() => startEdit(tx)} aria-label="Editar" title="Editar">
                            <IconEdit />
                          </button>
                          <button className="icon-btn danger" onClick={() => setDeletingId(tx.id)} aria-label="Eliminar" title="Eliminar">
                            <IconTrash />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
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
