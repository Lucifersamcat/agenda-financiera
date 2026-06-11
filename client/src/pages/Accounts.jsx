import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { fmtMoney } from '../format.js';
import Toast from '../components/Toast.jsx';

const DEFAULT_COLORS = ['#6366f1','#059669','#f59e0b','#e11d48','#8b5cf6','#06b6d4','#f97316','#10b981'];
const TYPE_LABELS    = { bank: 'Banco', cash: 'Efectivo', savings: 'Ahorros', other: 'Otro' };
const CURRENCIES     = ['DOP', 'USD', 'EUR'];

const emptyForm = { name: '', type: 'bank', currency: 'DOP', color: DEFAULT_COLORS[0] };

const TypeIcon = ({ type }) => {
  if (type === 'cash') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="2"/>
      <path d="M6 12h.01M18 12h.01"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
      <line x1="6" y1="15" x2="9" y2="15"/>
    </svg>
  );
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm]         = useState(emptyForm);
  const [editing, setEditing]   = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [archivingId, setArchivingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setAccounts(await api.getAccounts());
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(a) {
    setEditing(a.id);
    setForm({ name: a.name, type: a.type, currency: a.currency, color: a.color });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      if (editing) {
        await api.updateAccount(editing, form);
        setToast({ message: 'Cuenta actualizada' });
      } else {
        await api.createAccount(form);
        setToast({ message: 'Cuenta creada' });
      }
      cancelEdit();
      await load();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleArchive(id) {
    setArchivingId(null);
    try {
      await api.deleteAccount(id);
      setToast({ message: 'Cuenta archivada' });
      await load();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <h1 className="page-title">Cuentas</h1>
      </div>

      <div className="accounts-layout">
        {/* Form panel */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <span className="card-title">{editing ? 'Editar cuenta' : 'Nueva cuenta'}</span>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: BCP Ahorros"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select
                  className="form-select"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="bank">Banco</option>
                  <option value="cash">Efectivo</option>
                  <option value="savings">Ahorros</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Moneda</label>
                <select
                  className="form-select"
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Color</label>
              <div className="color-picker" style={{ paddingTop: 2 }}>
                {DEFAULT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch${form.color === c ? ' selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
              <button type="submit" className="btn btn-primary">
                {editing ? 'Guardar' : 'Crear cuenta'}
              </button>
              {editing && (
                <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Account list */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <span className="card-title">Mis cuentas</span>
          </div>
          {loading ? (
            <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 12, width: '50%', marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: '30%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
              <div className="empty-title">Sin cuentas</div>
              <div className="empty-body">Crea tu primera cuenta a la izquierda.</div>
            </div>
          ) : accounts.map(a => (
            <div
              className={`account-item${archivingId === a.id ? ' confirming' : ''}`}
              key={a.id}
            >
              <div className="account-icon" style={{ background: a.color }}>
                <div style={{ opacity: 0.75, color: '#fff' }}>
                  <TypeIcon type={a.type} />
                </div>
              </div>

              <div className="account-info">
                <div className="account-name">{a.name}</div>
                <div className="account-type">{TYPE_LABELS[a.type] ?? a.type} · {a.currency}</div>
              </div>

              <div className={`account-bal ${Number(a.balance) >= 0 ? 'positive' : 'negative'}`}>
                {fmtMoney(a.balance, a.currency)}
              </div>

              <div className="account-actions">
                {archivingId === a.id ? (
                  <div className="inline-confirm">
                    <span className="inline-confirm-label">¿Archivar?</span>
                    <button className="btn btn-sm btn-danger" onClick={() => handleArchive(a.id)}>Sí</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setArchivingId(null)}>No</button>
                  </div>
                ) : (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => startEdit(a)}>Editar</button>
                    <button className="btn btn-sm btn-danger-soft" onClick={() => setArchivingId(a.id)}>Archivar</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
