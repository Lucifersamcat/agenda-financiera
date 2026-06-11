import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { fmtMoney, fmtDate } from '../format.js';
import { useSettings } from '../settings-context.jsx';
import { CategoriesEditor, AccountTypesEditor, CustomFieldsEditor } from '../components/CatalogEditors.jsx';
import Toast from '../components/Toast.jsx';

const CURRENCIES = ['DOP', 'USD', 'EUR'];
const PERIOD_LABELS = { week: 'Semana', month: 'Mes', year: 'Año' };
const PAGE_SIZES = [10, 15, 25, 50];

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [archived, setArchived] = useState([]);
  const [toast, setToast]       = useState(null);
  const [wipeText, setWipeText] = useState('');
  const [wiping, setWiping]     = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const fileRef = useRef(null);

  async function loadArchived() {
    try { setArchived(await api.getArchivedAccounts()); } catch {}
  }

  useEffect(() => { loadArchived(); }, []);

  async function savePref(patch) {
    try {
      await updateSettings(patch);
      setToast({ message: 'Preferencias guardadas' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleRestore(id) {
    try {
      await api.restoreAccount(id);
      setToast({ message: 'Cuenta restaurada' });
      await loadArchived();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  async function handleExport() {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agenda-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ message: 'Backup descargado' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.app !== 'agenda-financiera' || !Array.isArray(data.accounts)) {
          setToast({ message: 'El archivo no parece un backup de Agenda Financiera', type: 'error' });
          return;
        }
        setPendingImport(data);
      } catch {
        setToast({ message: 'El archivo no es un JSON válido', type: 'error' });
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!pendingImport || importing) return;
    setImporting(true);
    try {
      const res = await api.importData(pendingImport);
      setToast({ message: `Backup restaurado: ${res.accounts} cuentas, ${res.transactions} transacciones` });
      setPendingImport(null);
      await loadArchived();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
    setImporting(false);
  }

  async function handleWipe() {
    if (wipeText !== 'BORRAR' || wiping) return;
    setWiping(true);
    try {
      await api.wipeData();
      setWipeText('');
      setToast({ message: 'Todos los datos fueron borrados' });
      await loadArchived();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
    setWiping(false);
  }

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Ajustes</h1>
          <p className="page-sub">Preferencias, categorías, tipos de cuenta, campos personalizados y tus datos</p>
        </div>
      </div>

      <div className="settings-stack">
        {/* Preferencias */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Preferencias</span>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <div className="settings-label">Moneda por defecto</div>
              <div className="settings-desc">Se usa al crear cuentas nuevas.</div>
            </div>
            <select
              className="form-select settings-control"
              value={settings.default_currency}
              onChange={e => savePref({ default_currency: e.target.value })}
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <div className="settings-label">Período inicial del dashboard</div>
              <div className="settings-desc">Con qué rango se abre el dashboard.</div>
            </div>
            <select
              className="form-select settings-control"
              value={settings.dashboard_period}
              onChange={e => savePref({ dashboard_period: e.target.value })}
            >
              {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <div className="settings-label">Filas por página</div>
              <div className="settings-desc">Cuántas transacciones se muestran por página.</div>
            </div>
            <select
              className="form-select settings-control"
              value={settings.page_size}
              onChange={e => savePref({ page_size: Number(e.target.value) })}
            >
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Catálogos editables */}
        <CategoriesEditor setToast={setToast} />
        <AccountTypesEditor setToast={setToast} />
        <CustomFieldsEditor setToast={setToast} />

        {/* Cuentas archivadas */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              Cuentas archivadas {archived.length > 0 && <span className="card-count">{archived.length}</span>}
            </span>
          </div>
          {archived.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 24px' }}>
              <div className="empty-body">No tienes cuentas archivadas.</div>
            </div>
          ) : archived.map(a => (
            <div className="settings-row" key={a.id}>
              <div className="settings-info" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="acct-dot" style={{ background: a.color }} />
                <div>
                  <div className="settings-label">{a.name}</div>
                  <div className="settings-desc">
                    {a.currency} · balance {fmtMoney(a.balance, a.currency)} · creada {fmtDate(a.created_at)}
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => handleRestore(a.id)}>
                Restaurar
              </button>
            </div>
          ))}
        </div>

        {/* Datos */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Datos</span>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <div className="settings-label">Exportar backup</div>
              <div className="settings-desc">Descarga un JSON con todas tus cuentas, transacciones, transferencias y notas.</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleExport}>Descargar</button>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <div className="settings-label">Restaurar backup</div>
              <div className="settings-desc">Reemplaza todos los datos actuales con los del archivo.</div>
            </div>
            {pendingImport ? (
              <div className="inline-confirm">
                <span className="inline-confirm-label">¿Reemplazar todo?</span>
                <button className="btn btn-sm btn-danger" onClick={confirmImport} disabled={importing}>
                  {importing ? 'Importando…' : 'Sí'}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setPendingImport(null)}>No</button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                Elegir archivo
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleFileChosen}
            />
          </div>
        </div>

        {/* Zona de peligro */}
        <div className="card danger-card">
          <div className="card-header">
            <span className="card-title" style={{ color: 'var(--danger)' }}>Zona de peligro</span>
          </div>
          <div className="settings-row">
            <div className="settings-info">
              <div className="settings-label">Borrar todos los datos</div>
              <div className="settings-desc">
                Elimina cuentas, transacciones, transferencias y notas de forma permanente.
                Escribe <strong>BORRAR</strong> para confirmar.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <input
                className="form-input"
                style={{ width: 110 }}
                value={wipeText}
                onChange={e => setWipeText(e.target.value)}
                placeholder="BORRAR"
              />
              <button
                className="btn btn-danger btn-sm"
                disabled={wipeText !== 'BORRAR' || wiping}
                onClick={handleWipe}
              >
                {wiping ? 'Borrando…' : 'Borrar todo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
