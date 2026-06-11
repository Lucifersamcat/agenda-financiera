export const EXPENSE_CATEGORIES = [
  { id: 'comida',          label: 'Comida',          color: '#f59e0b' },
  { id: 'supermercado',    label: 'Supermercado',    color: '#84cc16' },
  { id: 'transporte',      label: 'Transporte',      color: '#06b6d4' },
  { id: 'vivienda',        label: 'Vivienda',        color: '#8b5cf6' },
  { id: 'servicios',       label: 'Servicios',       color: '#0ea5e9' },
  { id: 'salud',           label: 'Salud',           color: '#e11d48' },
  { id: 'educacion',       label: 'Educación',       color: '#6366f1' },
  { id: 'entretenimiento', label: 'Entretenimiento', color: '#d946ef' },
  { id: 'compras',         label: 'Compras',         color: '#f97316' },
  { id: 'ropa',            label: 'Ropa',            color: '#ec4899' },
  { id: 'viajes',          label: 'Viajes',          color: '#14b8a6' },
  { id: 'mascotas',        label: 'Mascotas',        color: '#a3e635' },
  { id: 'deudas',          label: 'Deudas',          color: '#64748b' },
  { id: 'familia',         label: 'Familia',         color: '#fb7185' },
  { id: 'otros',           label: 'Otros',           color: '#94a3b8' },
];

export const INCOME_CATEGORIES = [
  { id: 'salario',     label: 'Salario',     color: '#059669' },
  { id: 'negocio',     label: 'Negocio',     color: '#10b981' },
  { id: 'freelance',   label: 'Freelance',   color: '#22c55e' },
  { id: 'inversiones', label: 'Inversiones', color: '#84cc16' },
  { id: 'regalo',      label: 'Regalo',      color: '#f59e0b' },
  { id: 'reembolso',   label: 'Reembolso',   color: '#06b6d4' },
  { id: 'otros',       label: 'Otros',       color: '#94a3b8' },
];

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function categoriesFor(type) {
  return type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function categoryInfo(id) {
  const found = ALL.find(c => c.id === id);
  if (found) return found;
  const label = id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Otros';
  return { id: id ?? 'otros', label, color: '#94a3b8' };
}
