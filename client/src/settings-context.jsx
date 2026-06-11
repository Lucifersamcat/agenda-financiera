import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

export const SETTING_DEFAULTS = {
  default_currency: 'DOP',
  dashboard_period: 'month',
  page_size: 15,
};

const SettingsContext = createContext({
  settings: SETTING_DEFAULTS,
  updateSettings: async () => {},
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(() => setSettings(SETTING_DEFAULTS));
  }, []);

  const updateSettings = useCallback(async (patch) => {
    const updated = await api.updateSettings(patch);
    setSettings(updated);
    return updated;
  }, []);

  // Las páginas leen los ajustes al montar (período inicial, filas por página),
  // así que no se renderiza nada hasta tenerlos.
  if (!settings) return null;

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
