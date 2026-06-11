import { useState } from 'react';
import { api } from '../api.js';
import { useSettings } from '../settings-context.jsx';
import { IconPlus, IconEdit, IconTrash } from './Icons.jsx';

const SWATCHES = ['#6366f1','#059669','#f59e0b','#e11d48','#8b5cf6','#06b6d4','#f97316','#10b981','#84cc16','#ec4899','#14b8a6','#64748b'];
const KIND_LABELS = { EXPENSE: 'Egreso', INCOME: 'Ingreso', BOTH: 'Ambos' };
const FIELD_TYPE_LABELS = { text: 'Texto', number: 'Número', select: 'Lista', date: 'Fecha', boolean: 'Sí/No' };

function parseJson(raw, fallback) {
  try { return JSON.parse(raw) ?? fallback; } catch { return fallback; }
}

/* ---------- Categorías ---------- */

export function CategoriesEditor({ setToast }) {
  const { categories, refreshCatalogs } = useSettings();
  const [editing, setEditing]   = useState(null); // id | 'new' | null
  const [form, setForm]         = useState({ name: '', color: SWATCHES[0], kind: 'EXPENSE' });
  const [deleting, setDeleting] = useState(null); // id | null
  const [reassign, setReassign] = useState('otros');

  function startNew() {
    setEditing('new');
    setForm({ name: '', color: SWATCHES[0], kind: 'EXPENSE' });
    setDeleting(null);
  }

  function startEdit(c) {
    setEditing(c.id);
    setForm({ name: c.name, color: c.color, kind: c.kind });
    setDeleting(null);
  }

  async function save() {
    if (!form.name.trim()) return;
    try {
      if (editing === 'new') {
        await api.createCategory(form);
        setToast({ message: 'Categoría creada' });
      } else {
        await api.updateCategory(editing, form);
        setToast({ message: 'Categoría actualizada' });
      }
      setEditing(null);
      await refreshCatalogs();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function remove(id) {
    try {
      await api.deleteCategory(id, reassign);
      setToast({ message: 'Categoría eliminada' });
      setDeleting(null);
      await refreshCatalogs();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  const editorRow = (
    <div className="catalog-form">
      <input
        className="form-input"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="Nombre de la categoría"
        autoFocus
      />
      <select
        className="form-select"
        value={form.kind}
        onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
        disabled={editing !== 'new' && categories.find(c => c.id === editing)?.slug === 'otros'}
      >
        {Object.entries(KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <div className="color-picker">
        {SWATCHES.map(c => (
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
      <div className="catalog-form-actions">
        <button className="btn btn-sm btn-primary" onClick={save}>Guardar</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          Categorías {categories.length > 0 && <span className="card-count">{categories.length}</span>}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={startNew}><IconPlus size={11} /> Nueva</button>
      </div>

      {editing === 'new' && <div className="settings-row">{editorRow}</div>}

      {categories.map(c => (
        <div className="settings-row" key={c.id}>
          {editing === c.id ? editorRow : deleting === c.id ? (
            <>
              <div className="settings-info" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="acct-dot" style={{ background: c.color }} />
                <span className="settings-label">{c.name}</span>
              </div>
              <div className="inline-confirm" style={{ flexWrap: 'wrap' }}>
                <span className="inline-confirm-label">Mover sus transacciones a</span>
                <select className="form-select" style={{ width: 140, height: 28, fontSize: 12 }}
                  value={reassign} onChange={e => setReassign(e.target.value)}>
                  {categories.filter(o => o.id !== c.id).map(o => (
                    <option key={o.slug} value={o.slug}>{o.name}</option>
                  ))}
                </select>
                <button className="btn btn-sm btn-danger" onClick={() => remove(c.id)}>Eliminar</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setDeleting(null)}>Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <div className="settings-info" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="acct-dot" style={{ background: c.color }} />
                <span className="settings-label">{c.name}</span>
                <span className="kind-badge">{KIND_LABELS[c.kind]}</span>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="icon-btn" onClick={() => startEdit(c)} aria-label="Editar" title="Editar">
                  <IconEdit />
                </button>
                {c.slug !== 'otros' && (
                  <button className="icon-btn danger" onClick={() => { setDeleting(c.id); setReassign('otros'); setEditing(null); }}
                    aria-label="Eliminar" title="Eliminar">
                    <IconTrash />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Tipos de cuenta ---------- */

export function AccountTypesEditor({ setToast }) {
  const { accountTypes, refreshCatalogs } = useSettings();
  const [editing, setEditing]   = useState(null);
  const [name, setName]         = useState('');
  const [deleting, setDeleting] = useState(null);
  const [reassign, setReassign] = useState('other');

  async function save() {
    if (!name.trim()) return;
    try {
      if (editing === 'new') {
        await api.createAccountType({ name });
        setToast({ message: 'Tipo de cuenta creado' });
      } else {
        await api.updateAccountType(editing, { name });
        setToast({ message: 'Tipo de cuenta actualizado' });
      }
      setEditing(null);
      await refreshCatalogs();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function remove(id) {
    try {
      await api.deleteAccountType(id, reassign);
      setToast({ message: 'Tipo de cuenta eliminado' });
      setDeleting(null);
      await refreshCatalogs();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  const editorRow = (
    <div className="catalog-form">
      <input
        className="form-input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nombre del tipo"
        autoFocus
      />
      <div className="catalog-form-actions">
        <button className="btn btn-sm btn-primary" onClick={save}>Guardar</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Tipos de cuenta</span>
        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing('new'); setName(''); setDeleting(null); }}>
          <IconPlus size={11} /> Nuevo
        </button>
      </div>

      {editing === 'new' && <div className="settings-row">{editorRow}</div>}

      {accountTypes.map(t => (
        <div className="settings-row" key={t.id}>
          {editing === t.id ? editorRow : deleting === t.id ? (
            <>
              <span className="settings-label">{t.name}</span>
              <div className="inline-confirm" style={{ flexWrap: 'wrap' }}>
                <span className="inline-confirm-label">Mover sus cuentas a</span>
                <select className="form-select" style={{ width: 130, height: 28, fontSize: 12 }}
                  value={reassign} onChange={e => setReassign(e.target.value)}>
                  {accountTypes.filter(o => o.id !== t.id).map(o => (
                    <option key={o.slug} value={o.slug}>{o.name}</option>
                  ))}
                </select>
                <button className="btn btn-sm btn-danger" onClick={() => remove(t.id)}>Eliminar</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setDeleting(null)}>Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <span className="settings-label">{t.name}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="icon-btn" onClick={() => { setEditing(t.id); setName(t.name); setDeleting(null); }}
                  aria-label="Editar" title="Editar">
                  <IconEdit />
                </button>
                {t.slug !== 'other' && (
                  <button className="icon-btn danger" onClick={() => { setDeleting(t.id); setReassign('other'); setEditing(null); }}
                    aria-label="Eliminar" title="Eliminar">
                    <IconTrash />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Campos personalizados ---------- */

export function CustomFieldsEditor({ setToast }) {
  const { customFields, refreshCatalogs } = useSettings();
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ name: '', type: 'text', options: '', applies_to: 'BOTH' });
  const [deleting, setDeleting] = useState(null);

  function startNew() {
    setEditing('new');
    setForm({ name: '', type: 'text', options: '', applies_to: 'BOTH' });
    setDeleting(null);
  }

  function startEdit(f) {
    setEditing(f.id);
    setForm({
      name: f.name,
      type: f.type,
      options: parseJson(f.options, []).join(', '),
      applies_to: f.applies_to,
    });
    setDeleting(null);
  }

  async function save() {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name,
      applies_to: form.applies_to,
      options: form.options.split(',').map(s => s.trim()).filter(Boolean),
    };
    try {
      if (editing === 'new') {
        await api.createCustomField({ ...payload, type: form.type });
        setToast({ message: 'Campo creado' });
      } else {
        await api.updateCustomField(editing, payload);
        setToast({ message: 'Campo actualizado' });
      }
      setEditing(null);
      await refreshCatalogs();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function remove(id) {
    try {
      await api.deleteCustomField(id);
      setToast({ message: 'Campo eliminado' });
      setDeleting(null);
      await refreshCatalogs();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  const editorRow = (
    <div className="catalog-form">
      <input
        className="form-input"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="Nombre del campo"
        autoFocus
      />
      <div className="form-row">
        <select
          className="form-select"
          value={form.type}
          onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          disabled={editing !== 'new'}
          title={editing !== 'new' ? 'El tipo no se puede cambiar' : undefined}
        >
          {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          className="form-select"
          value={form.applies_to}
          onChange={e => setForm(f => ({ ...f, applies_to: e.target.value }))}
        >
          <option value="BOTH">Ingresos y egresos</option>
          <option value="EXPENSE">Solo egresos</option>
          <option value="INCOME">Solo ingresos</option>
        </select>
      </div>
      {form.type === 'select' && (
        <input
          className="form-input"
          value={form.options}
          onChange={e => setForm(f => ({ ...f, options: e.target.value }))}
          placeholder="Opciones separadas por coma: Efectivo, Tarjeta..."
        />
      )}
      <div className="catalog-form-actions">
        <button className="btn btn-sm btn-primary" onClick={save}>Guardar</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Campos personalizados de transacciones</span>
        <button className="btn btn-ghost btn-sm" onClick={startNew}><IconPlus size={11} /> Nuevo</button>
      </div>

      {customFields.length === 0 && editing !== 'new' && (
        <div className="empty-state" style={{ padding: '24px' }}>
          <div className="empty-body">Sin campos personalizados. Crea uno, por ejemplo «Método de pago».</div>
        </div>
      )}

      {editing === 'new' && <div className="settings-row">{editorRow}</div>}

      {customFields.map(f => (
        <div className="settings-row" key={f.id}>
          {editing === f.id ? editorRow : deleting === f.id ? (
            <>
              <span className="settings-label">{f.name}</span>
              <div className="inline-confirm">
                <span className="inline-confirm-label">¿Eliminar el campo?</span>
                <button className="btn btn-sm btn-danger" onClick={() => remove(f.id)}>Sí</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setDeleting(null)}>No</button>
              </div>
            </>
          ) : (
            <>
              <div className="settings-info">
                <div className="settings-label">{f.name}</div>
                <div className="settings-desc">
                  {FIELD_TYPE_LABELS[f.type]}
                  {f.type === 'select' && ` · ${parseJson(f.options, []).join(', ')}`}
                  {f.applies_to !== 'BOTH' && ` · ${f.applies_to === 'EXPENSE' ? 'solo egresos' : 'solo ingresos'}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="icon-btn" onClick={() => startEdit(f)} aria-label="Editar" title="Editar">
                  <IconEdit />
                </button>
                <button className="icon-btn danger" onClick={() => { setDeleting(f.id); setEditing(null); }}
                  aria-label="Eliminar" title="Eliminar">
                  <IconTrash />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
