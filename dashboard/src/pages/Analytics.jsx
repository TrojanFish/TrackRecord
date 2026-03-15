import React from 'react';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, CartesianGrid, Legend, AreaChart, Area 
} from 'recharts';
import { Calendar, Activity, Zap, Layers, TrendingUp, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const Analytics = ({ stats }) => {
  const [activeMetric, setActiveMetric] = React.useState('dist'); // 'dist', 'time', 'elev'
  const [hiddenYears, setHiddenYears] = React.useState(new Set());

  if (!stats) return null;

  const toggleYear = (year) => {
    const newHidden = new Set(hiddenYears);
    if (newHidden.has(year)) {
        newHidden.delete(year);
    } else {
        newHidden.add(year);
    }
    setHiddenYears(newHidden);
  };

  const metricLabel = {
      dist: 'DISTANCE (KM)',
      time: 'TIME (HOURS)',
      elev: 'ELEVATION (M)'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="page-content"
    >
      {/* YoY Progress Chart */}
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={20} color="var(--accent-cyan)" /> YEAR-OVER-YEAR CUMULATIVE {metricLabel[activeMetric]}
            </h3>
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
                {['dist', 'time', 'elev'].map(m => (
                    <button
                        key={m}
                        onClick={() => setActiveMetric(m)}
                        style={{
                            padding: '6px 12px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: activeMetric === m ? 'var(--accent-cyan)' : 'transparent',
                            color: activeMetric === m ? '#000' : 'var(--text-secondary)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {m.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>
        <div style={{ height: '400px', width: '100%' }}>
          <ResponsiveContainer>
            <LineChart data={stats.yoy_cumulative}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                onClick={(e) => toggleYear(e.dataKey.split('_')[0])}
                formatter={(value) => (
                    <span style={{ 
                        color: hiddenYears.has(value.split('_')[0]) ? '#444' : 'var(--text-primary)',
                        textDecoration: hiddenYears.has(value.split('_')[0]) ? 'line-through' : 'none',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600
                    }}>
                        {value.split('_')[0]}
                    </span>
                )}
              />
              {stats.available_years?.map((year, idx) => (
                <Line 
                  key={year} 
                  type="monotone" 
                  dataKey={`${year}_${activeMetric}`} 
                  stroke={idx === stats.available_years.length - 1 ? 'var(--accent-cyan)' : (`hsl(${idx * 45}, 70%, 50%)`)} 
                  strokeWidth={idx === stats.available_years.length - 1 ? 4 : 1.5}
                  dot={false}
                  name={year}
                  hide={hiddenYears.has(year)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Weekday Analysis */}
        <div className="platform-card" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={20} color="var(--accent-cyan)" /> WEEKDAY ANALYSIS
          </h3>
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={stats.weekday_preference?.map(d => ({ 
                ...d, 
                name: d.day || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.weekday] 
              }))}>
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time Preference */}
        <div className="platform-card" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} color="#bd00ff" /> TIME OF DAY PREFERENCE
          </h3>
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={stats.time_preference?.map(t => ({ 
                ...t, 
                label: `${t.slot < 10 ? '0' : ''}${t.slot}:00` 
              }))}>
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="count" stroke="#bd00ff" fill="rgba(189, 0, 255, 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Performance Table */}
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={20} color="#f59e0b" /> MONTHLY PERFORMANCE COMPARISON
          </h3>
          <div style={{ overflowX: 'auto' }}>
              <table className="analytics-table">
                  <thead>
                      <tr>
                          <th>MONTH</th>
                          <th>THIS YEAR (KM)</th>
                          <th>LAST YEAR (KM)</th>
                          <th>VARIANCE</th>
                      </tr>
                  </thead>
                  <tbody>
                      {stats.period_comparison?.slice(0, new Date().getMonth() + 1).reverse().map((m, idx) => {
                          const diff = m.this_year - m.last_year;
                          const percent = m.last_year > 0 ? ((diff / m.last_year) * 100).toFixed(1) : '100+';
                          return (
                              <tr key={m.month}>
                                  <td style={{ fontWeight: 800 }}>{m.month.toUpperCase()}</td>
                                  <td><b style={{ color: 'var(--accent-cyan)' }}>{m.this_year}</b></td>
                                  <td style={{ opacity: 0.6 }}>{m.last_year}</td>
                                  <td style={{ color: diff >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                          {diff >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                          {Math.abs(diff).toFixed(1)} km ({percent}%)
                                      </div>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Gear Statistics */}
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={20} color="var(--accent-cyan)" /> GEAR LONGEVITY TRACKING
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
          {stats.gear_stats?.map(gear => {
            const percent = Math.min(100, (gear.distance / gear.limit) * 100);
            return (
              <div key={gear.name} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{gear.name}</span>
                  <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{gear.distance} / {gear.limit} KM</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{ 
                      height: '100%', 
                      background: percent > 90 ? '#ef4444' : (percent > 70 ? '#f59e0b' : 'var(--accent-cyan)'),
                      boxShadow: `0 0 10px ${percent > 90 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(6, 182, 212, 0.4)'}`
                    }} 
                  />
                </div>
                <div style={{ marginTop: '0.8rem', fontSize: '0.7rem', opacity: 0.5, textAlign: 'right' }}>
                  {percent.toFixed(1)}% LIFE EXPENDED
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default Analytics;
