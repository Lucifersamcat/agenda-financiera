import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomFieldsEditor } from '../components/CatalogEditors.jsx';
import { IconArrowLeft } from '../components/Icons.jsx';
import Toast from '../components/Toast.jsx';

export default function CatalogCustomFields() {
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="catalog-back">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/settings')}>
          <IconArrowLeft size={13} /> Ajustes
        </button>
      </div>
      <div className="settings-stack">
        <CustomFieldsEditor setToast={setToast} />
      </div>
    </div>
  );
}
