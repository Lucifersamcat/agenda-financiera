import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../api.js';
import { fmtMoney, fmtNumber, fmtDate } from '../format.js';
import { categoryInfo } from '../categories.js';

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
    return d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric' });
  }
  const [y, m] = period.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('es-DO', { month: 'short', year: '2-digit' });
}

function fmtK(v) { return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v; }

// Accounts can be in different currencies, so totals only make sense per currency.
function totalsByCurrency(byAccount) {
  const map = new Map();
  for (const a of byAccount) {
    const row = map.get(a.currency) ?? { currency: a.currency, income: 0, expenses: 0 };
    row.income += Number(a.income);
    row.expenses += Number(a.expenses);
    map.set(a.currency, row);
  }
  const rows = [...map.values()].filter(r => r.income !== 0 || r.expenses !== 0);
  return rows.length ? rows : [{ currency: 'DOP', income: 0, expenses: 0 }];
}

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
  const [distCurrency, setDistCurrency] = useState(null);
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
      api.getTransactions({ ...params, limit: 6, page: 1 }),
      api.getTimeline(tlCfg),
    ]);
    setSummary(s);
    setDistribution(d);
    setDistCurrency(null);
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

  // Distribution comes as {category, currency, expenses}: never mix monedas.
  const distTotals = new Map();
  for (const row of distribution) {
    distTotals.set(row.currency, (distTotals.get(row.currency) ?? 0) + Number(row.expenses));
  }
  const distCurrencies = [...distTotals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const activeCurrency = distCurrency ?? distCurrencies[0];
  const pieData = distribution
    .filter(r => r.currency === activeCurrency)
    .map(r => {
      const cat = categoryInfo(r.category);
      return { name: cat.label, value: Number(r.expenses), color: cat.color, currency: r.currency };
    });
  const pieTotal = pieData.reduce((s, r) => s + r.value, 0);

  const totals = totalsByCurrency(summary?.by_account ?? []);
  const statValueClass = totals.length > 1 ? 'stat-value sm' : 'stat-value';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Resumen de tu actividad financiera</p>
        </div>
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
          {[...Array(3)].map((_, i) => (
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
              {totals.map(t => (
                <div key={t.currency} className={statValueClass}>
                  {fmtMoney(t.income - t.expenses, t.currency)}
                </div>
              ))}
              <div className="stat-sub">{PERIODS[periodIdx].label} actual</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <span className="stat-dot" style={{ background: '#059669' }} />
                Ingresos
              </div>
              {totals.map(t => (
                <div key={t.currency} className={`${statValueClass} positive`}>
                  {fmtMoney(t.income, t.currency)}
                </div>
              ))}
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <span className="stat-dot" style={{ background: '#e11d48' }} />
                Egresos
              </div>
              {totals.map(t => (
                <div key={t.currency} className={`${statValueClass} negative`}>
                  {fmtMoney(t.expenses, t.currency)}
                </div>
              ))}
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-title">Ingresos vs Egresos</div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={barData} margin={{ top: 0, right: 0, left: -8, bottom: 0 }} barCategoryGap="32%">
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmtK} width={38} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => fmtNumber(v)} {...TooltipStyle} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 8 }} />
                  <Bar dataKey="Ingresos" fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Egresos"  fill="#e11d48" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-title-row">
                <div className="chart-title">Egresos por categoría</div>
                {distCurrencies.length > 1 && (
                  <div className="chip-group">
                    {distCurrencies.map(c => (
                      <button
                        key={c}
                        className={`chip${c === activeCurrency ? ' active' : ''}`}
                        onClick={() => setDistCurrency(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {pieData.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-body">Sin egresos en este período</div>
                </div>
              ) : (
                <>
                  <div className="donut-wrap">
                    <ResponsiveContainer width="100%" height={170}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%" cy="50%"
                          innerRadius={55}
                          outerRadius={78}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {pieData.map((row, i) => (
                            <Cell key={i} fill={row.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v, _name, entry) => fmtMoney(v, entry?.payload?.currency)}
                          {...TooltipStyle}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <div className="donut-center-label">Total</div>
                      <div className="donut-center-value">{fmtMoney(pieTotal, activeCurrency)}</div>
                    </div>
                  </div>
                  <div className="legend-list">
                    {pieData.slice(0, 5).map(row => (
                      <div className="legend-row" key={row.name}>
                        <span className="acct-dot" style={{ background: row.color }} />
                        <span className="legend-name">{row.name}</span>
                        <span className="legend-value">{fmtMoney(row.value, row.currency)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bottom-grid">
            <div className="card" style={{ marginBottom: 0 }}>
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
                        <th>Categoría</th>
                        <th style={{ textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(tx => {
                        const cat = categoryInfo(tx.category);
                        return (
                          <tr key={tx.id}>
                            <td className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tx.description || <span className="text-muted">—</span>}
                            </td>
                            <td>
                              <span className="cat-cell">
                                <span className="acct-dot" style={{ background: cat.color }} />
                                {cat.label}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className={`amount ${tx.type === 'INCOME' ? 'positive' : 'negative'}`}>
                                {tx.type === 'INCOME' ? '+' : '−'}{fmtMoney(tx.amount, tx.account_currency)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <span className="card-title">Cuentas</span>
              </div>
              {(summary?.by_account ?? []).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-body">Aún no tienes cuentas.</div>
                </div>
              ) : (summary?.by_account ?? []).map(a => (
                <div className="balance-row" key={a.id}>
                  <span className="acct-dot" style={{ background: a.color }} />
                  <span className="balance-name">{a.name}</span>
                  <span className="balance-currency">{a.currency}</span>
                  <span className={`balance-amount ${Number(a.balance) >= 0 ? 'positive' : 'negative'}`}>
                    {fmtMoney(a.balance, a.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
