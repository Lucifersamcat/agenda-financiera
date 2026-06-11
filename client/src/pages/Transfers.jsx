import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { fmtMoney } from '../format.js';
import Toast from '../components/Toast.jsx';

const emptyForm = {
  from_account_id: '',
  to_account_id: '',
  amount_from: '',
  amount_to: '',
  date: new Date().toISOString().slice(0, 10),
  description: '',
};

const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: .5 }}>
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

export default function Transfers() {
  const [transfers, setTransfers] = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [form, setForm]           = useState(emptyForm);
  const [editing, setEditing]     = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [toast, setToast]         = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading]     = useState(true);

  const loadAccounts = async () => {
    try { setAccounts(await api.getAccounts()); } catch {}
  };

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      setTransfers(await api.getTransfers());
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadTransfers(); }, [loadTransfers]);

  useEffect(() => {
    if (!showForm) return;
    const onKey = e => { if (e.key === 'Escape') cancelForm(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fromAcct = accounts.find(a => String(a.id) === form.from_account_id);
  const toAcct   = accounts.find(a => String(a.id) === form.to_account_id);
  const crossCurrency = fromAcct && toAcct && fromAcct.currency !== toAcct.currency;

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(tr) {
    setEditing(tr.id);
    setForm({
      from_account_id: String(tr.from_account_id),
      to_account_id:   String(tr.to_account_id),
      amount_from:     String(tr.amount_from),
      amount_to:       String(tr.amount_to),
      date:            tr.date,
      description:     tr.description ?? '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      from_account_id: Number(form.from_account_id),
      to_account_id:   Number(form.to_account_id),
      amount_from:     Number(form.amount_from),
      date:            form.date,
      description:     form.description.trim() || '',
    };
    if (crossCurrency) payload.amount_to = Number(form.amount_to);

    try {
      if (editing) {
        await api.updateTransfer(editing, payload);
        setToast({ message: 'Transferencia actualizada' });
      } else {
        await api.createTransfer(payload);
        setToast({ message: 'Transferencia registrada' });
      }
      cancelForm();
      await loadTransfers();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleDelete(id) {
    setDeletingId(null);
    try {
      await api.deleteTransfer(id);
      setToast({ message: 'Transferencia eliminada' });
      await loadTransfers();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showForm && (
        <div className="modal-backdrop" onClick={cancelForm}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">
                {editing ? 'Editar transferencia' : 'Nueva transferencia'}
              </span>
              <button className="modal-close-btn" onClick={cancelForm} aria-label="Cerrar">
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <form id="transfer-form" onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Desde</label>
                      <select
                        className="form-select"
                        value={form.from_account_id}
                        onChange={e => setForm(f => ({ ...f, from_account_id: e.target.value }))}
                        required
                      >
                        <option value="">Seleccionar...</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Hacia</label>
                      <select
                        className="form-select"
                        value={form.to_account_id}
                        onChange={e => setForm(f => ({ ...f, to_account_id: e.target.value }))}
                        required
                      >
                        <option value="">Seleccionar...</option>
                        {accounts
                          .filter(a => String(a.id) !== form.from_account_id)
                          .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        Monto enviado{fromAcct ? ` (${fromAcct.currency})` : ''}
                      </label>
                      <input
                        className="form-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.amount_from}
                        onChange={e => setForm(f => ({ ...f, amount_from: e.target.value }))}
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

                  {crossCurrency && (
                    <div className="form-group">
                      <label className="form-label">Monto recibido ({toAcct.currency})</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.amount_to}
                        onChange={e => setForm(f => ({ ...f, amount_to: e.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  )}

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
              <button type="submit" form="transfer-form" className="btn btn-primary">
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
        <h1 className="page-title">Transferencias</h1>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Origen → Destino</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="loading-rows">
                  <td colSpan={5}>Cargando...</td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                        <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                      </svg>
                      <div className="empty-title">Sin transferencias</div>
                      <div className="empty-body">Registra tu primera transferencia entre cuentas.</div>
                    </div>
                  </td>
                </tr>
              ) : transfers.map(tr => (
                <tr key={tr.id} className={deletingId === tr.id ? 'row-confirming' : ''}>
                  <td className="text-muted text-sm mono" style={{ whiteSpace: 'nowrap' }}>{tr.date}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tr.description || <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <span className="acct-cell" style={{ gap: 8 }}>
                      <span className="acct-cell">
                        <span className="acct-dot" style={{ background: tr.from_color }} />
                        {tr.from_name}
                      </span>
                      <ArrowIcon />
                      <span className="acct-cell">
                        <span className="acct-dot" style={{ background: tr.to_color }} />
                        {tr.to_name}
                      </span>
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span className="amount">
                      {fmtMoney(tr.amount_from, tr.from_currency)}
                      {tr.from_currency !== tr.to_currency && (
                        <span className="text-muted text-sm"> → {fmtMoney(tr.amount_to, tr.to_currency)}</span>
                      )}
                    </span>
                  </td>
                  <td>
                    {deletingId === tr.id ? (
                      <div className="inline-confirm">
                        <span className="inline-confirm-label">¿Eliminar?</span>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(tr.id)}>Sí</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setDeletingId(null)}>No</button>
                      </div>
                    ) : (
                      <div className="table-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => startEdit(tr)}>Editar</button>
                        <button className="btn btn-sm btn-danger-soft" onClick={() => setDeletingId(tr.id)}>Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
