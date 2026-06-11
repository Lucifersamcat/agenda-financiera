import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

export const SETTING_DEFAULTS = {
  default_currency: 'DOP',
  dashboard_period: 'month',
  page_size: 15,
};

const SettingsContext = createContext({
  settings: SETTING_DEFAULTS,
  categories: [],
  accountTypes: [],
  customFields: [],
  updateSettings: async () => {},
  refreshCatalogs: async () => {},
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [catalogs, setCatalogs] = useState({ categories: [], accountTypes: [], customFields: [] });

  const refreshCatalogs = useCallback(async () => {
    const [categories, accountTypes, customFields] = await Promise.all([
      api.getCategories().catch(() => []),
      api.getAccountTypes().catch(() => []),
      api.getCustomFields().catch(() => []),
    ]);
    setCatalogs({ categories, accountTypes, customFields });
  }, []);

  useEffect(() => {
    Promise.all([
      api.getSettings().catch(() => SETTING_DEFAULTS),
      refreshCatalogs(),
    ]).then(([s]) => setSettings(s));
  }, [refreshCatalogs]);

  const updateSettings = useCallback(async (patch) => {
    const updated = await api.updateSettings(patch);
    setSettings(updated);
    return updated;
  }, []);

  // Las páginas leen los ajustes y catálogos al montar, así que no se
  // renderiza nada hasta tenerlos.
  if (!settings) return null;

  return (
    <SettingsContext.Provider value={{ settings, ...catalogs, updateSettings, refreshCatalogs }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

// Helpers sobre los catálogos cargados.
export function categoriesFor(categories, type) {
  return categories.filter(c => c.kind === type || c.kind === 'BOTH');
}

export function categoryInfo(categories, slug) {
  const found = categories.find(c => c.slug === slug);
  if (found) return found;
  const name = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Otros';
  return { slug: slug ?? 'otros', name, color: '#94a3b8' };
}

export function customFieldsFor(customFields, type) {
  return customFields.filter(f => f.applies_to === type || f.applies_to === 'BOTH');
}
