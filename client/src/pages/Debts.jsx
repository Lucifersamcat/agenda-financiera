import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { fmtMoney, fmtDate } from '../format.js';
import { IconPlus, IconEdit, IconTrash, IconChevronRight } from '../components/Icons.jsx';
import { useSettings } from '../settings-context.jsx';
import Toast from '../components/Toast.jsx';

const CURRENCIES = ['DOP', 'USD', 'EUR'];

const today = () => new Date().toISOString().slice(0, 10);

const emptyPayForm = () => ({ amount: '', date: today(), note: '' });

export default function Debts() {
  const { settings, debtTypes } = useSettings();
  const typeName = (slug) => debtTypes.find(t => t.slug === slug)?.name ?? slug;

  const emptyForm = () => ({
    name: '', type: debtTypes[0]?.slug ?? 'otro', currency: settings.default_currency,
    principal: '', total_to_pay: '', interest_rate: '', rate_period: 'MONTHLY',
    start_date: today(), due_date: '', description: '',
  });

  const [debts, setDebts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [expanded, setExpanded] = useState(null);   // debt id
  const [payments, setPayments] = useState([]);     // abonos de la deuda expandida
  const [payForm, setPayForm]   = useState(emptyPayForm);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingPayId, setDeletingPayId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setDebts(await api.getDebts());
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function replaceDebt(updated) {
    setDebts(ds => ds.map(d => (d.id === updated.id ? { ...d, ...updated } : d)));
  }

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return; }
    try {
      const detail = await api.getDebt(id);
      setPayments(detail.payments);
      setPayForm(emptyPayForm());
      setDeletingPayId(null);
      setExpanded(id);
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  }

  function startNew() {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function startEdit(d) {
    setEditing(d.id);
    setForm({
      name: d.name, type: d.type ?? 'otro', currency: d.currency,
      principal: d.principal, total_to_pay: d.total_to_pay ?? '',
      interest_rate: d.interest_rate ?? '', rate_period: d.rate_period ?? 'MONTHLY',
      start_date: d.start_date, due_date: d.due_date ?? '', description: d.description,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      principal: Number(form.principal),
      total_to_pay: form.total_to_pay === '' ? null : Number(form.total_to_pay),
      interest_rate: form.interest_rate === '' ? null : Number(form.interest_rate),
      rate_period: form.interest_rate === '' ? null : form.rate_period,
      due_date: form.due_date || null,
    };
    try {
      if (editing) {
        const updated = await api.updateDebt(editing, payload);
        replaceDebt(updated);
        setToast({ message: 'Deuda actualizada' });
      } else {
        await api.createDebt(payload);
        await load();
        setToast({ message: 'Deuda creada' });
      }
      closeForm();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleDelete(id) {
    setDeletingId(null);
    try {
      await api.deleteDebt(id);
      if (expanded === id) setExpanded(null);
      setDebts(ds => ds.filter(d => d.id !== id));
      setToast({ message: 'Deuda eliminada' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleAddPayment(e) {
    e.preventDefault();
    if (!payForm.amount) return;
    try {
      const res = await api.createDebtPayment(expanded, {
        amount: Number(payForm.amount), date: payForm.date, note: payForm.note,
      });
      setPayments(ps => [res.payment, ...ps]);
      replaceDebt(res.debt);
      setPayForm(emptyPayForm());
      setToast({ message: 'Abono registrado' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleDeletePayment(paymentId) {
    setDeletingPayId(null);
    try {
      const res = await api.deleteDebtPayment(expanded, paymentId);
      setPayments(ps => ps.filter(p => p.id !== paymentId));
      replaceDebt(res.debt);
      setToast({ message: 'Abono eliminado' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  // Pendiente total por moneda (solo deudas activas).
  const totals = new Map();
  for (const d of debts) {
    if (d.status !== 'ACTIVE') continue;
    const row = totals.get(d.currency) ?? { pending: 0, count: 0 };
    row.pending += d.pending;
    row.count += 1;
    totals.set(d.currency, row);
  }

  const sorted = [...debts].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
    if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date || b.due_date) return a.due_date ? -1 : 1;
    return 0;
  });

  const isOverdue = (d) => d.status === 'ACTIVE' && d.due_date && d.due_date < today();

  const rateLabel = (d) =>
    d.interest_rate ? `${d.interest_rate}% ${d.rate_period === 'ANNUAL' ? 'anual' : 'mensual'}` : null;

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Deudas</h1>
          <p className="page-sub">Préstamos, créditos y tarjetas con sus abonos</p>
        </div>
        <button className="btn btn-primary" onClick={formOpen ? closeForm : startNew}>
          {formOpen ? 'Cerrar' : <><IconPlus size={11} /> Nueva deuda</>}
        </button>
      </div>

      {totals.size > 0 && (
        <div className="stats-grid">
          {[...totals.entries()].map(([currency, t]) => (
            <div className="stat-card" key={currency}>
              <div className="stat-label">Pendiente · {currency}</div>
              <div className="stat-value negative">{fmtMoney(t.pending, currency)}</div>
              <div className="stat-sub">{t.count} {t.count === 1 ? 'deuda activa' : 'deudas activas'}</div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{editing ? 'Editar deuda' : 'Nueva deuda'}</span>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Nombre / acreedor</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Préstamo Banreservas"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select
                  className="form-select"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                >
                  {debtTypes.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
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
              <div className="form-group">
                <label className="form-label">Monto original</label>
                <input
                  className="form-input" type="number" step="0.01" min="0.01"
                  value={form.principal}
                  onChange={e => setForm(f => ({ ...f, principal: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Total a pagar (opcional)</label>
                <input
                  className="form-input" type="number" step="0.01" min="0.01"
                  value={form.total_to_pay}
                  onChange={e => setForm(f => ({ ...f, total_to_pay: e.target.value }))}
                  placeholder="Con intereses incluidos"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Interés % (opcional)</label>
                <input
                  className="form-input" type="number" step="0.01" min="0"
                  value={form.interest_rate}
                  onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                  placeholder="Ej: 10"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Período del interés</label>
                <select
                  className="form-select"
                  value={form.rate_period}
                  onChange={e => setForm(f => ({ ...f, rate_period: e.target.value }))}
                  disabled={form.interest_rate === ''}
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="ANNUAL">Anual</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha de inicio</label>
                <input
                  className="form-input" type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha límite (opcional)</label>
                <input
                  className="form-input" type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nota (opcional)</label>
              <input
                className="form-input"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detalles, condiciones..."
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary">
                {editing ? 'Guardar' : 'Crear deuda'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Mis deudas {debts.length > 0 && <span className="card-count">{debts.length}</span>}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="skeleton" style={{ height: 13, width: '40%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 5, width: '100%' }} />
              </div>
            ))}
          </div>
        ) : debts.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/>
            </svg>
            <div className="empty-title">Sin deudas</div>
            <div className="empty-body">Registra tu primera deuda con «Nueva deuda».</div>
          </div>
        ) : sorted.map(d => {
          const pct = d.target > 0 ? Math.min(100, (d.paid / d.target) * 100) : 0;
          const open = expanded === d.id;
          return (
            <div className={`debt-item${open ? ' open' : ''}`} key={d.id}>
              <div className="debt-row" onClick={() => toggleExpand(d.id)}>
                <div className="debt-row-main">
                  <div className="debt-row-top">
                    <span className="debt-name">{d.name}</span>
                    <span className="type-chip">{typeName(d.type)}</span>
                    {d.status === 'PAID' && <span className="pill-paid">Pagada</span>}
                    {isOverdue(d) && <span className="pill-overdue">Vencida</span>}
                  </div>
                  <div className="debt-row-meta">
                    {d.due_date && d.status === 'ACTIVE' && (
                      <span className={isOverdue(d) ? 'debt-meta-danger' : ''}>Vence {fmtDate(d.due_date)}</span>
                    )}
                    {rateLabel(d) && <span>{rateLabel(d)}</span>}
                    {d.payments_count > 0 && (
                      <span>{d.payments_count} {d.payments_count === 1 ? 'abono' : 'abonos'}</span>
                    )}
                  </div>
                </div>
                <div className="debt-amounts">
                  <span className={`debt-pending${d.status === 'PAID' ? ' paid' : ''}`}>
                    {fmtMoney(d.pending, d.currency)}
                  </span>
                  <span className="debt-target">de {fmtMoney(d.target, d.currency)}</span>
                </div>
                <span className={`debt-chevron${open ? ' open' : ''}`}><IconChevronRight /></span>
              </div>

              <div className="debt-progress">
                <div className="progress-track">
                  <div
                    className={`progress-fill${d.status === 'PAID' ? ' complete' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {open && (
                <div className="debt-detail">
                  <div className="debt-facts">
                    <span>Monto original: <strong>{fmtMoney(d.principal, d.currency)}</strong></span>
                    {d.accrued_interest > 0 && (
                      <span>Intereses: <strong>{fmtMoney(d.accrued_interest, d.currency)}</strong></span>
                    )}
                    <span>Abonado: <strong>{fmtMoney(d.paid, d.currency)}</strong></span>
                    <span>Inicio: <strong>{fmtDate(d.start_date)}</strong></span>
                    {d.description && <span className="debt-note">{d.description}</span>}
                  </div>

                  <form className="abono-form" onSubmit={handleAddPayment}>
                    <input
                      className="form-input" type="date"
                      value={payForm.date}
                      onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))}
                      required
                    />
                    <input
                      className="form-input" type="number" step="0.01" min="0.01"
                      value={payForm.amount}
                      onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="Monto"
                      required
                    />
                    <input
                      className="form-input"
                      value={payForm.note}
                      onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))}
                      placeholder="Nota (opcional)"
                    />
                    <button type="submit" className="btn btn-primary btn-sm">Agregar abono</button>
                  </form>

                  {payments.length > 0 && (
                    <div className="abono-list">
                      {payments.map(p => (
                        <div className="abono-row" key={p.id}>
                          <span className="abono-date">{fmtDate(p.date)}</span>
                          <span className="abono-amount">{fmtMoney(p.amount, d.currency)}</span>
                          <span className="abono-note">{p.note}</span>
                          {deletingPayId === p.id ? (
                            <div className="inline-confirm">
                              <span className="inline-confirm-label">¿Eliminar?</span>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeletePayment(p.id)}>Sí</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => setDeletingPayId(null)}>No</button>
                            </div>
                          ) : (
                            <button className="icon-btn danger" onClick={() => setDeletingPayId(p.id)}
                              aria-label="Eliminar abono" title="Eliminar abono">
                              <IconTrash />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="debt-detail-actions">
                    {deletingId === d.id ? (
                      <div className="inline-confirm">
                        <span className="inline-confirm-label">¿Eliminar la deuda y sus abonos?</span>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.id)}>Eliminar</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setDeletingId(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(d)}>
                          <IconEdit size={12} /> Editar
                        </button>
                        <button className="btn btn-ghost btn-sm danger-text" onClick={() => setDeletingId(d.id)}>
                          <IconTrash size={12} /> Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
