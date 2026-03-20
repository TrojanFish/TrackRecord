import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Repeat, MapPin, Activity, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const TYPE_COLORS = {
  Run: '#ff3366', TrailRun: '#ff6b8a', VirtualRun: '#ff8fab',
  Ride: '#06b6d4', VirtualRide: '#22d3ee', EBikeRide: '#67e8f9',
};

const RepeatRoutes = ({ stats }) => {
  const [sortBy, setSortBy] = useState('count');

  if (!stats) return null;

  const routes = (stats.repeat_routes || []).sort((a, b) => b[sortBy] - a[sortBy]);
  const totalRepeats = routes.reduce((s, r) => s + r.count, 0);
  const uniqueRoutes = routes.length;
  const topCity = routes[0]?.city || '—';
  const mostRepeated = routes[0];

  const chartData = routes.slice(0, 12).map(r => ({
    name: `${r.city} ~${r.distance_km}km`,
    count: r.count,
    type: r.type,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content"
    >
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'REPEAT ROUTES', value: uniqueRoutes, color: '#06b6d4' },
          { label: 'TOTAL REPEATS', value: totalRepeats, color: '#8b5cf6' },
          { label: 'TOP CITY', value: topCity, color: '#f59e0b', small: true },
          { label: 'MOST REPEATED', value: mostRepeated ? `${mostRepeated.distance_km} km × ${mostRepeated.count}` : '—', color: '#10b981', small: true },
        ].map(s => (
          <div key={s.label} className="platform-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.55rem', fontWeight: 800, opacity: 0.5, letterSpacing: '0.5px', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: s.small ? '1rem' : '1.6rem', fontWeight: 900, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {routes.length === 0 ? (
        <div className="platform-card" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
          <Repeat size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
          <p>No repeat routes detected yet. Routes done 3+ times at the same city and distance will appear here.</p>
        </div>
      ) : (
        <>
          {/* Bar Chart */}
          <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Repeat size={20} color="#06b6d4" /> TOP REPEAT ROUTES
              </h3>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {[['count', 'TIMES']].map(([key, label]) => (
                  <button key={key} onClick={() => setSortBy(key)} style={{
                    padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
                    background: sortBy === key ? '#06b6d4' : 'transparent',
                    color: sortBy === key ? '#000' : 'var(--text-secondary)',
                  }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 110 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} width={110} />
                  <Tooltip
                    contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(v) => [`${v} times`, 'Repeated']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={TYPE_COLORS[entry.type] || '#06b6d4'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Route Cards Grid */}
          <div className="platform-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {routes.map((route, idx) => {
              const color = TYPE_COLORS[route.type] || '#06b6d4';
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="platform-card interactive-card"
                  style={{ padding: '1.25rem', borderLeft: `3px solid ${color}` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color, fontSize: '0.7rem', fontWeight: 800 }}>
                      <MapPin size={12} /> {route.city}
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: '999px', background: `${color}20`, color, fontSize: '0.6rem', fontWeight: 800 }}>
                      {route.type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 900, color, lineHeight: 1 }}>{route.distance_km}</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>km route</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: 700 }}><Repeat size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />{route.count}× repeated</span>
                    <span style={{ opacity: 0.4 }}>Last: {route.dates?.[0] || '—'}</span>
                  </div>
                  {route.names?.length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', opacity: 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      e.g. "{route.names[0]}"
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default RepeatRoutes;
