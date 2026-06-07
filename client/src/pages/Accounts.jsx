import { useState, useEffect } from 'react';
import { api } from '../api.js';
import Toast from '../components/Toast.jsx';

const DEFAULT_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

function fmt(n) {
  return Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyForm = { name: '', type: 'bank', color: DEFAULT_COLORS[0] };

export default function Accounts() {
  const [accounts, setAccounts]   = useState([]);
  const [form, setForm]           = useState(emptyForm);
  const [editing, setEditing]     = useState(null);
  const [toast, setToast]         = useState(null);
  const [loading, setLoading]     = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(a) {
    setEditing(a.id);
    setForm({ name: a.name, type: a.type, color: a.color });
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
        setToast({ message: 'Cuenta actualizada', type: 'info' });
      } else {
        await api.createAccount(form);
        setToast({ message: 'Cuenta creada', type: 'info' });
      }
      cancelEdit();
      await load();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleArchive(id) {
    if (!confirm('¿Archivar esta cuenta?')) return;
    try {
      await api.deleteAccount(id);
      setToast({ message: 'Cuenta archivada', type: 'info' });
      await load();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <h1>Cuentas</h1>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="section">
            <h3>{editing ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
            <form className="form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Banco BCP"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="bank">Banco</option>
                    <option value="cash">Efectivo</option>
                    <option value="savings">Ahorros</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
                    {DEFAULT_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, color: c }))}
                        style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: c, border: form.color === c ? '3px solid #1e293b' : '2px solid transparent',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary">{editing ? 'Guardar' : 'Crear'}</button>
                {editing && <button type="button" className="btn btn-ghost" onClick={cancelEdit}>Cancelar</button>}
              </div>
            </form>
          </div>
        </div>

        <div style={{ flex: 2, minWidth: 300 }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
          ) : accounts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No hay cuentas. Crea una a la izquierda.</p>
          ) : (
            <div className="account-list">
              {accounts.map(a => (
                <div className="account-item" key={a.id}>
                  <div className="account-dot" style={{ background: a.color }} />
                  <div className="account-info">
                    <div className="account-name">{a.name}</div>
                    <div className="account-meta">{a.type}</div>
                  </div>
                  <div className="account-balance" style={{ color: Number(a.balance) >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                    S/ {fmt(a.balance)}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => startEdit(a)}>Editar</button>
                    <button className="btn btn-danger"  style={{ padding: '5px 10px' }} onClick={() => handleArchive(a.id)}>Archivar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
