import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { fmtDate } from '../format.js';
import { IconPlus } from '../components/Icons.jsx';
import Toast from '../components/Toast.jsx';

const emptyNote = { title: '', content: '' };

export default function Notes() {
  const [notes, setNotes]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(emptyNote);
  const [dirty, setDirty]       = useState(false);
  const [toast, setToast]       = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    setConfirmDelete(false);
  }

  function newNote() {
    setSelected(null);
    setForm(emptyNote);
    setDirty(false);
    setConfirmDelete(false);
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
        setToast({ message: 'Nota guardada' });
      } else {
        const created = await api.createNote(form);
        setSelected(created.id);
        setToast({ message: 'Nota creada' });
      }
      setDirty(false);
      await load();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      await api.deleteNote(selected);
      setToast({ message: 'Nota eliminada' });
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
        <div>
          <h1 className="page-title">Notas</h1>
          <p className="page-sub">Apuntes rápidos y recordatorios</p>
        </div>
        <button className="btn btn-primary" onClick={newNote}>
          <IconPlus />
          Nueva nota
        </button>
      </div>

      <div className="notes-layout">
        {/* Note list */}
        <div>
          {notes.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-title">Sin notas</div>
              <div className="empty-body">Crea tu primera nota.</div>
            </div>
          ) : (
            <div className="notes-list-wrap">
              {notes.map(n => (
                <div
                  key={n.id}
                  className={`note-item${selected === n.id ? ' selected' : ''}`}
                  onClick={() => openNote(n)}
                >
                  <div className="note-item-title">{n.title}</div>
                  {n.content && <div className="note-item-preview">{n.content}</div>}
                  <div className="note-item-date">{fmtDate(n.updated_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="notes-editor">
          <div className="notes-editor-bar">
            {currentNote && (
              <span className="notes-editor-meta">
                Editado {fmtDate(currentNote.updated_at)}
              </span>
            )}

            {selected && (
              confirmDelete ? (
                <div className="inline-confirm">
                  <span className="inline-confirm-label">¿Eliminar?</span>
                  <button className="btn btn-sm btn-danger" onClick={handleDelete}>Sí</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)}>No</button>
                </div>
              ) : (
                <button className="btn btn-sm btn-danger-soft" onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </button>
              )
            )}

            {dirty && selected && (
              <button className="btn btn-sm btn-ghost" onClick={() => { openNote(currentNote); }}>
                Descartar
              </button>
            )}

            <button
              className="btn btn-sm btn-primary"
              onClick={handleSave}
              disabled={!dirty && !!selected}
            >
              {selected ? 'Guardar' : 'Crear nota'}
            </button>
          </div>

          <input
            className="notes-title-input"
            value={form.title}
            onChange={e => change('title', e.target.value)}
            placeholder="Título"
          />
          <textarea
            className="notes-content-input"
            value={form.content}
            onChange={e => change('content', e.target.value)}
            placeholder="Comienza a escribir..."
          />
        </div>
      </div>
    </div>
  );
}
