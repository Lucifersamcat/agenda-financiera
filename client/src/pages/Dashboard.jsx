import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, Tooltip as PieTooltip,
} from 'recharts';
import { api } from '../api.js';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const PERIODS = [
  { label: 'Semana', days: 7  },
  { label: 'Mes',    days: 30 },
  { label: 'Año',   days: 365 },
];

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function periodDates(days) {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  return { from: toDateStr(from), to: toDateStr(to) };
}

function timelineConfig(periodIdx) {
  const to  = toDateStr(new Date());
  if (periodIdx === 0) {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { groupBy: 'day', from: toDateStr(from), to };
  }
  if (periodIdx === 1) {
    const from = new Date();
    from.setMonth(from.getMonth() - 5);
    from.setDate(1);
    return { groupBy: 'month', from: toDateStr(from), to };
  }
  const from = new Date();
  from.setMonth(from.getMonth() - 11);
  from.setDate(1);
  return { groupBy: 'month', from: toDateStr(from), to };
}

function fillTimeline(data, { groupBy, from, to }) {
  const dataMap = Object.fromEntries(data.map(d => [d.period, d]));
  const result  = [];
  const current = new Date(from + 'T12:00:00');
  const end     = new Date(to   + 'T12:00:00');
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

function fmtPeriodLabel(period, groupBy) {
  if (groupBy === 'day') {
    const d = new Date(period + 'T12:00:00');
    return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
  }
  const [y, m] = period.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1);
  return d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
}

function fmt(n) {
  return Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtK(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return v;
}

export default function Dashboard() {
  const [periodIdx, setPeriodIdx]       = useState(1);
  const [summary, setSummary]           = useState(null);
  const [distribution, setDistribution] = useState([]);
  const [timeline, setTimeline]         = useState([]);
  const [recent, setRecent]             = useState([]);
  const [loading, setLoading]           = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params   = periodDates(PERIODS[periodIdx].days);
    const tlConfig = timelineConfig(periodIdx);
    const [s, d, t, tl] = await Promise.all([
      api.getSummary(params),
      api.getDistribution(params),
      api.getTransactions({ ...params, limit: 5, page: 1 }),
      api.getTimeline(tlConfig),
    ]);
    setSummary(s);
    setDistribution(d);
    setRecent(t.data ?? []);
    setTimeline(fillTimeline(tl, tlConfig));
    setLoading(false);
  }, [periodIdx]);

  useEffect(() => { load(); }, [load]);

  const tlGroupBy = timelineConfig(periodIdx).groupBy;
  const barData   = timeline.map(row => ({
    name:      fmtPeriodLabel(row.period, tlGroupBy),
    Ingresos:  Number(row.income),
    Egresos:   Number(row.expenses),
  }));

  const pieData = distribution.map(a => ({
    name:  a.name,
    value: Number(a.expenses),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="period-selector">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              className={`btn-period${i === periodIdx ? ' active' : ''}`}
              onClick={() => setPeriodIdx(i)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
      ) : (
        <>
          <div className="cards-row">
            <div className="card card-total">
              <div className="card-label">Balance</div>
              <div className="card-value" style={{ color: Number(summary?.balance) >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                S/ {fmt(summary?.balance)}
              </div>
              <div className="card-sub">{PERIODS[periodIdx].label}</div>
            </div>
            <div className="card">
              <div className="card-label">Ingresos</div>
              <div className="card-value positive">S/ {fmt(summary?.total_income)}</div>
            </div>
            <div className="card">
              <div className="card-label">Egresos</div>
              <div className="card-value negative">S/ {fmt(summary?.total_expenses)}</div>
            </div>
            {(summary?.by_account ?? []).map(a => (
              <div className="card" key={a.id}>
                <div className="card-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, display: 'inline-block' }} />
                  {a.name}
                </div>
                <div className="card-value" style={{ fontSize: 18, color: Number(a.balance) >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                  S/ {fmt(a.balance)}
                </div>
              </div>
            ))}
          </div>

          <div className="charts-row">
            <div className="chart-box" style={{ flex: 2 }}>
              <h3>Ingresos vs Egresos</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} width={36} />
                  <Tooltip formatter={(v) => `S/ ${fmt(v)}`} />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Egresos"  fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-box">
              <h3>Distribución de egresos</h3>
              {pieData.length === 0 ? (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Sin egresos en este período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <PieTooltip formatter={(v) => `S/ ${fmt(v)}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="section">
            <h3>Últimas transacciones</h3>
            {recent.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin transacciones en este período.</p>
            ) : (
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
                      <td>{tx.date}</td>
                      <td>{tx.description || '—'}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tx.account_color, display: 'inline-block', flexShrink: 0 }} />
                          {tx.account_name}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${tx.type === 'INCOME' ? 'income' : 'expense'}`}>
                          {tx.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} className={tx.type === 'INCOME' ? 'positive' : 'negative'}>
                        {tx.type === 'INCOME' ? '+' : '-'}S/ {fmt(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
