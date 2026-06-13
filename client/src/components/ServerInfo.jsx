import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

const IconInfo = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

function Row({ label, url, hint }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard no disponible */ }
  }

  return (
    <div className="srvinfo-row">
      <div className="srvinfo-label">{label}</div>
      <button className="srvinfo-url" onClick={copy} title="Copiar">
        <span>{url}</span>
        <span className="srvinfo-copy">{copied ? '¡Copiado!' : 'Copiar'}</span>
      </button>
      {hint && <div className="srvinfo-hint">{hint}</div>}
    </div>
  );
}

export default function ServerInfo() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open || info) return;
    api.getServerInfo().then(setInfo).catch(() => {});
  }, [open, info]);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="srvinfo" ref={ref}>
      {open && (
        <div className="srvinfo-pop">
          <div className="srvinfo-title">Dirección de la app</div>
          {!info ? (
            <div className="srvinfo-loading">Cargando…</div>
          ) : (
            <>
              <Row label="En esta computadora" url={info.local} />
              {info.network && (
                <Row
                  label="Otros dispositivos en tu red"
                  url={info.network}
                  hint="Abre esta dirección en tu teléfono u otra PC conectada al mismo WiFi."
                />
              )}
              <div className="srvinfo-foot">Puerto {info.port}</div>
            </>
          )}
        </div>
      )}
      <button
        className={`nav-item srvinfo-btn${open ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <IconInfo />
        <span>Información</span>
      </button>
    </div>
  );
}
