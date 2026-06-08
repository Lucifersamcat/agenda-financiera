import { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="toast-wrap">
      <div className={`toast toast-${type === 'error' ? 'error' : 'info'}`}>
        {message}
      </div>
    </div>
  );
}
