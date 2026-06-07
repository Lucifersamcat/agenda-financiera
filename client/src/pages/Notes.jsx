import { useState, useEffect } from 'react';
import { api } from '../api.js';
import Toast from '../components/Toast.jsx';

const emptyNote = { title: '', content: '' };

function fmtDate(s) {
  return new Date(s).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Notes() {
  const [notes, setNotes]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm]       = useState(emptyNote);
  const [dirty, setDirty]     = useState(false);
  const [toast, setToast]     = useState(null);

  async function load() {
    try {
      const data = await api.getNotes();
      setNotes(data);
      return data;
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
      return [];
    }
  }

  useEffect(() => {
    async function init() {
      const data = await load();
      if (data.length > 0) {
        setSelected(data[0].id);
        setForm({ title: data[0].title, content: data[0].content ?? '' });
      }
    }
    init();
  }, []);

  function openNote(note) {
    setSelected(note.id);
    setForm({ title: note.title, content: note.content ?? '' });
    setDirty(false);
  }

  function newNote() {
    setSelected(null);
    setForm(emptyNote);
    setDirty(false);
  }

  function change(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setDirty(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setToast({ message: 'El título es requerido', type: 'error' }); return; }
    try {
      if (selected) {
        await api.updateNote(selected, form);
        setToast({ message: 'Nota guardada', type: 'info' });
      } else {
        const created = await api.createNote(form);
        setSelected(created.id);
        setToast({ message: 'Nota creada', type: 'info' });
      }
      setDirty(false);
      await load();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      await api.deleteNote(selected);
      setToast({ message: 'Nota eliminada', type: 'info' });
      newNote();
      await load();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  const currentNote = notes.find(n => n.id === selected);

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <h1>Notas</h1>
        <button className="btn btn-primary" onClick={newNote}>+ Nueva nota</button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div className="notes-grid" style={{ width: 240, flexShrink: 0 }}>
          {notes.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin notas aún.</p>
          )}
          {notes.map(n => (
            <div
              key={n.id}
              className="note-card"
              style={{ borderColor: selected === n.id ? 'var(--primary)' : undefined }}
              onClick={() => openNote(n)}
            >
              <h4>{n.title}</h4>
              <p>{n.body || ' '}</p>
              <div className="note-date">{fmtDate(n.updated_at)}</div>
            </div>
          ))}
        </div>

        <div className="section" style={{ flex: 1 }}>
          <div className="form">
            <div className="form-group">
              <label>Título</label>
              <input
                value={form.title}
                onChange={e => change('title', e.target.value)}
                placeholder="Título de la nota"
              />
            </div>
            <div className="form-group">
              <label>Contenido</label>
              <textarea
                value={form.content}
                onChange={e => change('content', e.target.value)}
                rows={12}
                placeholder="Escribe tu nota aquí..."
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={!dirty && !!selected}>
                {selected ? 'Guardar cambios' : 'Crear nota'}
              </button>
              {selected && (
                <button className="btn btn-danger" onClick={handleDelete}>Eliminar</button>
              )}
              {selected && dirty && (
                <button className="btn btn-ghost" onClick={() => { openNote(currentNote); }}>Descartar</button>
              )}
            </div>
            {currentNote && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Última edición: {fmtDate(currentNote.updated_at)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
