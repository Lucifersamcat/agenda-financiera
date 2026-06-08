import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../api.js';

const COLORS = ['#6366f1', '#059669', '#f59e0b', '#e11d48', '#8b5cf6', '#06b6d4'];

const PERIODS = [
  { label: 'Semana', days: 7 },
  { label: 'Mes',    days: 30 },
  { label: 'Año',    days: 365 },
];

function toDateStr(d) { return d.toISOString().slice(0, 10); }

function periodDates(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  return { from: toDateStr(from), to: toDateStr(to) };
}

function timelineConfig(periodIdx) {
  const to = toDateStr(new Date());
  if (periodIdx === 0) {
    const from = new Date(); from.setDate(from.getDate() - 6);
    return { groupBy: 'day', from: toDateStr(from), to };
  }
  if (periodIdx === 1) {
    const from = new Date(); from.setMonth(from.getMonth() - 5); from.setDate(1);
    return { groupBy: 'month', from: toDateStr(from), to };
  }
  const from = new Date(); from.setMonth(from.getMonth() - 11); from.setDate(1);
  return { groupBy: 'month', from: toDateStr(from), to };
}

function fillTimeline(data, { groupBy, from, to }) {
  const dataMap = Object.fromEntries(data.map(d => [d.period, d]));
  const result = [];
  const current = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  if (groupBy === 'month') current.setDate(1);
  while (current <= end) {
    const period = groupBy === 'day'
      ? toDateStr(current)
      : `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    if (!result.some(r => r.period === period)) {
      result.push(dataMap[period] ?? { period, income: 0, expenses: 0 });
    }
    groupBy === 'day'
      ? current.setDate(current.getDate() + 1)
      : current.setMonth(current.getMonth() + 1);
  }
  return result;
}

function fmtLabel(period, groupBy) {
  if (groupBy === 'day') {
    const d = new Date(period + 'T12:00:00');
    return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
  }
  const [y, m] = period.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
}

function fmt(n) {
  return Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtK(v) { return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v; }

const TooltipStyle = {
  contentStyle: {
    background: '#0f172a',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,.25)',
    padding: '8px 12px',
  },
  labelStyle: { color: 'rgba(255,255,255,.55)', marginBottom: 4, fontSize: 11 },
  itemStyle: { color: 'rgba(255,255,255,.85)' },
  cursor: { fill: 'rgba(0,0,0,.04)' },
};

export default function Dashboard() {
  const [periodIdx, setPeriodIdx] = useState(1);
  const [summary, setSummary]     = useState(null);
  const [distribution, setDistribution] = useState([]);
  const [timeline, setTimeline]   = useState([]);
  const [recent, setRecent]       = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = periodDates(PERIODS[periodIdx].days);
    const tlCfg  = timelineConfig(periodIdx);
    const [s, d, t, tl] = await Promise.all([
      api.getSummary(params),
      api.getDistribution(params),
      api.getTransactions({ ...params, limit: 5, page: 1 }),
      api.getTimeline(tlCfg),
    ]);
    setSummary(s);
    setDistribution(d);
    setRecent(t.data ?? []);
    setTimeline(fillTimeline(tl, tlCfg));
    setLoading(false);
  }, [periodIdx]);

  useEffect(() => { load(); }, [load]);

  const tlGroupBy = timelineConfig(periodIdx).groupBy;
  const barData   = timeline.map(row => ({
    name:     fmtLabel(row.period, tlGroupBy),
    Ingresos: Number(row.income),
    Egresos:  Number(row.expenses),
  }));

  const pieData = distribution.map(a => ({
    name:  a.name,
    value: Number(a.expenses),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div className="period-tabs">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              className={`period-tab${i === periodIdx ? ' active' : ''}`}
              onClick={() => setPeriodIdx(i)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="stats-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ height: 11, width: '50%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 26, width: '70%' }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card primary">
              <div className="stat-label">Balance</div>
              <div className={`stat-value${Number(summary?.balance) >= 0 ? ' positive' : ' negative'}`}
                style={{ color: undefined }}>
                S/ {fmt(summary?.balance)}
              </div>
              <div className="stat-sub">{PERIODS[periodIdx].label} actual</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <span className="stat-dot" style={{ background: '#059669' }} />
                Ingresos
              </div>
              <div className="stat-value positive">S/ {fmt(summary?.total_income)}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <span className="stat-dot" style={{ background: '#e11d48' }} />
                Egresos
              </div>
              <div className="stat-value negative">S/ {fmt(summary?.total_expenses)}</div>
            </div>

            {(summary?.by_account ?? []).map(a => (
              <div className="stat-card" key={a.id}>
                <div className="stat-label">
                  <span className="stat-dot" style={{ background: a.color }} />
                  {a.name}
                </div>
                <div className={`stat-value${Number(a.balance) >= 0 ? ' positive' : ' negative'}`}>
                  S/ {fmt(a.balance)}
                </div>
              </div>
            ))}
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-title">Ingresos vs Egresos</div>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={barData} margin={{ top: 0, right: 0, left: -8, bottom: 0 }} barCategoryGap="32%">
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmtK} width={38} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => `S/ ${fmt(v)}`} {...TooltipStyle} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 8 }} />
                  <Bar dataKey="Ingresos" fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Egresos"  fill="#e11d48" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-title">Distribución de egresos</div>
              {pieData.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-body">Sin egresos en este período</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `S/ ${fmt(v)}`} {...TooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Últimas transacciones</span>
            </div>
            {recent.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">Sin transacciones</div>
                <div className="empty-body">No hay movimientos en este período.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th>Cuenta</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(tx => (
                      <tr key={tx.id}>
                        <td className="text-muted text-sm mono" style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                        <td>{tx.description || <span className="text-muted">—</span>}</td>
                        <td>
                          <span className="acct-cell">
                            <span className="acct-dot" style={{ background: tx.account_color }} />
                            {tx.account_name}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${tx.type === 'INCOME' ? 'income' : 'expense'}`}>
                            {tx.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`amount ${tx.type === 'INCOME' ? 'positive' : 'negative'}`}>
                            {tx.type === 'INCOME' ? '+' : '−'}S/ {fmt(tx.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
