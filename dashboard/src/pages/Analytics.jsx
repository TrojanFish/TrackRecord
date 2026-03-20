import React from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend, AreaChart, Area, ReferenceLine, Cell
} from 'recharts';
import { Calendar, Activity, Zap, Layers, TrendingUp, Filter, ArrowUpRight, ArrowDownRight, BarChart2, Percent, Heart, Sun, Dna } from 'lucide-react';

const Analytics = ({ stats, sportType }) => {
  const [activeMetric, setActiveMetric] = React.useState('dist'); // 'dist', 'time', 'elev'
  const [hiddenYears, setHiddenYears] = React.useState(new Set());

  if (!stats) return null;

  const isRun = sportType === 'Run';
  const themeColor = isRun ? '#ff3366' : 'var(--accent-cyan)';
  const secondaryColor = isRun ? '#ff8533' : '#bd00ff';

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content"
    >
      {/* YoY Progress Chart */}
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div className="card-header">
            <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                <TrendingUp size={20} color={themeColor} style={{ flexShrink: 0 }} /> YEAR-OVER-YEAR CUMULATIVE {metricLabel[activeMetric]}
            </h3>
            <div className="heatmap-controls" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1.5rem' }}>
                <div className="metric-toggle" style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
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
                                background: activeMetric === m ? themeColor : 'transparent',
                                color: activeMetric === m ? (isRun ? '#fff' : '#000') : 'var(--text-secondary)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {m.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
        </div>
        <div style={{ height: '400px', width: '100%' }}>
          <ResponsiveContainer>
            <LineChart data={stats.yoy_cumulative}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="day" 
                stroke="rgba(255,255,255,0.3)" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                ticks={[1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]}
                tickFormatter={(val) => {
                  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  const idx = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335].indexOf(val);
                  return idx !== -1 ? months[idx] : "";
                }}
              />
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
                        color: hiddenYears.has(value.split('_')[0]) ? 'rgba(255,255,255,0.25)' : 'var(--text-primary)',
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
                   stroke={idx === stats.available_years.length - 1 ? themeColor : (`hsla(${idx * 45}, 70%, 50%, 0.4)`)} 
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

      {/* Yearly Stats Comparison Table */}
      {stats.yearly_full && stats.yearly_full.length > 0 && (
        <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h3 className="card-title" style={{ fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            <TrendingUp size={20} color={themeColor} style={{ flexShrink: 0 }} /> YEARLY PERFORMANCE SUMMARY
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="analytics-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>YEAR</th>
                  <th>ACTIVITIES</th>
                  <th>DISTANCE (KM)</th>
                  <th>ELEVATION (M)</th>
                  <th>HOURS</th>
                </tr>
              </thead>
              <tbody>
                {stats.yearly_full.map(yr => (
                  <tr key={yr.year}>
                    <td style={{ fontWeight: 900, fontSize: '0.95rem', color: themeColor }}>{yr.year}</td>
                    <td>{yr.count}</td>
                    <td>
                      <b style={{ color: themeColor }}>{yr.distance}</b>
                      {yr.dist_delta !== null && (
                        <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: yr.dist_delta >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {yr.dist_delta >= 0 ? '↑' : '↓'} {Math.abs(yr.dist_delta)}
                        </span>
                      )}
                    </td>
                    <td>
                      {yr.elevation.toLocaleString()}
                      {yr.elev_delta !== null && (
                        <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: yr.elev_delta >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {yr.elev_delta >= 0 ? '↑' : '↓'} {Math.abs(yr.elev_delta).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td>
                      {yr.hours}h
                      {yr.hours_delta !== null && (
                        <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: yr.hours_delta >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {yr.hours_delta >= 0 ? '↑' : '↓'} {Math.abs(yr.hours_delta)}h
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', opacity: 0.4, whiteSpace: 'nowrap' }}>BEHAVIORAL PATTERNS</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        {/* Weekday Analysis */}
        <div className="platform-card" style={{ padding: '2rem' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
              <Calendar size={20} color={themeColor} style={{ flexShrink: 0 }} /> {sportType.toUpperCase()} WEEKDAY ANALYSIS
            </h3>
          </div>
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={stats.weekday_preference?.map(d => ({ 
                ...d, 
                name: d.day || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.weekday] 
              }))}>
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px' }} 
                />
                <Bar dataKey="count" fill={themeColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time Preference */}
        <div className="platform-card" style={{ padding: '2rem' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
              <Activity size={20} color={secondaryColor} style={{ flexShrink: 0 }} /> PRIME TIME PREFERENCE
            </h3>
          </div>
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={stats.time_preference?.map(t => ({ 
                ...t, 
                label: `${t.slot < 10 ? '0' : ''}${t.slot}:00` 
              }))}>
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="count" stroke={secondaryColor} fill={`${secondaryColor}33`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', opacity: 0.4, whiteSpace: 'nowrap' }}>STRUCTURE & EFFICIENCY</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Bio-Efficiency & Distribution */}
        <div className="platform-card" style={{ padding: '2rem' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                  <Zap size={20} color={themeColor} style={{ flexShrink: 0 }} /> {sportType === 'Run' ? 'DISTANCE STRUCTURE' : 'INTENSITY (HR ZONES)'}
              </h3>
            </div>
            <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer>
                    <BarChart data={isRun ? stats.distance_breakdown : stats.hr_zones}>
                        <XAxis dataKey={isRun ? "label" : "zone"} stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px' }} 
                        />
                        <Bar 
                            dataKey="count" 
                            fill={themeColor} 
                            radius={[4, 4, 0, 0]}
                            label={{ position: 'top', fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Specialized Stat Card */}
        <div className="platform-card" style={{ padding: '2rem', background: `linear-gradient(135deg, rgba(255,255,255,0.02) 0%, ${themeColor}11 100%)` }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.8 }}>
                <Layers size={18} color={themeColor} /> PRO PERSPECTIVE
            </h3>
            <div style={{ marginTop: '20px' }}>
                {isRun ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                             <div style={{ fontSize: '0.7rem', opacity: 0.7, letterSpacing: '1px' }}>ESTIMATED STEPS</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: themeColor }}>{stats.bio_stats?.estimated_steps?.toLocaleString()}</div>
                        </div>
                        <div>
                             <div style={{ fontSize: '0.7rem', opacity: 0.7, letterSpacing: '1px' }}>AVG CADENCE ({isRun ? 'SPM' : 'RPM'})</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900 }}>{stats.bio_stats?.avg_cadence || '--'}</div>
                            <div style={{ fontSize: '0.7rem', color: (stats.bio_stats?.cadence_trend || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                {stats.bio_stats?.cadence_trend >= 0 ? '+' : ''}{stats.bio_stats?.cadence_trend || 0}% vs prev. month
                            </div>
                        </div>
                        <div style={{ padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', fontSize: '0.8rem', opacity: 0.8 }}>
                            💡 Pro Tip: Maintaining a step frequency above 175 spm significantly reduces ground contact time and injury risk.
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                             <div style={{ fontSize: '0.7rem', opacity: 0.7, letterSpacing: '1px' }}>CLIMBING EFFICIENCY</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: themeColor }}>{Math.round((stats.total_distance > 0 ? (stats.recent_activities?.reduce((acc, a) => acc + (a.elevation_gain || 0), 0) / stats.total_distance) : 0) * 10)} <small style={{fontSize: '1rem'}}>VAM</small></div>
                        </div>
                        <div>
                             <div style={{ fontSize: '0.7rem', opacity: 0.7, letterSpacing: '1px' }}>AVG POWER OUTPUT</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: themeColor }}>
                              {(() => {
                                const acts = stats.recent_activities?.filter(a => (a.average_watts || 0) > 0);
                                if (!acts || acts.length === 0) return <span style={{ fontSize: '1.2rem', opacity: 0.4 }}>No power data</span>;
                                const avg = Math.round(acts.reduce((s, a) => s + a.average_watts, 0) / acts.length);
                                return <>{avg} <small style={{ fontSize: '1rem' }}>W</small></>;
                              })()}
                            </div>
                        </div>
                        <div style={{ padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', fontSize: '0.8rem', opacity: 0.8 }}>
                            Climbing Focus: Your elevation-to-distance ratio reflects endurance capacity. Target sustained efforts to build power over time.
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Morning vs Evening Comparison */}
      {(() => {
        const tp = stats.time_preference || [];
        const morning = tp.filter(t => t.slot >= 5 && t.slot < 12).reduce((s, t) => s + t.count, 0);
        const afternoon = tp.filter(t => t.slot >= 12 && t.slot < 17).reduce((s, t) => s + t.count, 0);
        const evening = tp.filter(t => t.slot >= 17 && t.slot < 22).reduce((s, t) => s + t.count, 0);
        const night = tp.filter(t => t.slot < 5 || t.slot >= 22).reduce((s, t) => s + t.count, 0);
        const total = morning + afternoon + evening + night || 1;
        const blocks = [
          { label: 'Morning', range: '5–12h', count: morning, color: '#f59e0b', icon: '🌅' },
          { label: 'Afternoon', range: '12–17h', count: afternoon, color: '#ff8533', icon: '☀️' },
          { label: 'Evening', range: '17–22h', count: evening, color: '#8b5cf6', icon: '🌆' },
          { label: 'Night', range: '22–5h', count: night, color: '#06b6d4', icon: '🌙' },
        ];
        const dominant = blocks.reduce((a, b) => a.count > b.count ? a : b);
        return (
          <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                <Filter size={20} color={themeColor} style={{ flexShrink: 0 }} /> TRAINING TIME DISTRIBUTION
              </h3>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.5 }}>
                You prefer <b style={{ color: dominant.color }}>{dominant.label}</b> {dominant.icon}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              {blocks.map(b => {
                const pct = Math.round((b.count / total) * 100);
                return (
                  <div key={b.label} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderTop: `3px solid ${b.color}` }}>
                    <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{b.icon}</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.7, marginBottom: '4px' }}>{b.label}</div>
                    <div style={{ fontSize: '0.55rem', opacity: 0.4, marginBottom: '8px' }}>{b.range}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: b.color, lineHeight: 1 }}>{pct}%</div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '4px' }}>{b.count} sessions</div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '8px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: b.color, borderRadius: '2px', transition: 'width 0.8s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Monthly Performance Table */}
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
              <Layers size={20} color="#f59e0b" style={{ flexShrink: 0 }} /> {sportType.toUpperCase()} MONTHLY PROGRESSION
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
              <table className="analytics-table" style={{ width: '100%' }}>
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
                                  <td><b style={{ color: themeColor }}>{m.this_year}</b></td>
                                   <td style={{ opacity: 0.8 }}>{m.last_year}</td>
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

      {/* 12-Week Consistency + RPE Trend */}
      {(() => {
        // --- 12-Week Consistency ---
        const today12 = new Date();
        const weekBuckets = Array.from({ length: 12 }, (_, wi) => {
          const weekEnd = new Date(today12);
          weekEnd.setDate(today12.getDate() - wi * 7);
          const weekStart = new Date(weekEnd);
          weekStart.setDate(weekEnd.getDate() - 6);
          const startStr = weekStart.toISOString().slice(0, 10);
          const endStr = weekEnd.toISOString().slice(0, 10);
          const activeDays = new Set(
            (stats.daily_stats || [])
              .filter(d => d.date >= startStr && d.date <= endStr && Number(d.count || 0) > 0)
              .map(d => d.date)
          ).size;
          return {
            week: `W-${wi === 0 ? 'now' : wi}`,
            activeDays
          };
        }).reverse();

        const consistentWeeks = weekBuckets.filter(w => w.activeDays >= 3).length;
        const consistencyPct = Math.round((consistentWeeks / 12) * 100);

        // --- RPE Trend ---
        const maxHR = stats.athlete_metrics?.max_hr || 190;
        const recentActs = (stats.recent_activities || []).slice(0, 30);

        // Group last 8 weeks and compute average RPE
        const rpeWeeks = Array.from({ length: 8 }, (_, wi) => {
          const weekEnd = new Date(today12);
          weekEnd.setDate(today12.getDate() - wi * 7);
          const weekStart = new Date(weekEnd);
          weekStart.setDate(weekEnd.getDate() - 6);
          const startStr = weekStart.toISOString().slice(0, 10);
          const endStr = weekEnd.toISOString().slice(0, 10);
          const weekActs = recentActs.filter(a => {
            const d = (a.start_date_local || '').slice(0, 10);
            return d >= startStr && d <= endStr;
          });
          let avgRPE = 0;
          if (weekActs.length > 0) {
            const rpes = weekActs.map(a => {
              if (a.average_heartrate && a.average_heartrate > 0) {
                return (a.average_heartrate / maxHR) * 100;
              }
              // fallback: moving_time / distance ratio normalized
              const dist = a.distance > 0 ? a.distance / 1000 : 1;
              const pace = (a.moving_time || 0) / 60 / dist; // min/km
              return Math.min(100, (pace / 10) * 100);
            });
            avgRPE = Math.round(rpes.reduce((s, v) => s + v, 0) / rpes.length);
          }
          return {
            week: `W-${wi === 0 ? 'now' : wi}`,
            rpe: avgRPE || null
          };
        }).reverse();

        return (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', opacity: 0.4, whiteSpace: 'nowrap' }}>TRAINING QUALITY</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>
          {/* Training Monotony & Strain card */}
          {stats.training_details && (
            <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                <Zap size={20} color={themeColor} style={{ flexShrink: 0 }} /> TRAINING MONOTONY & STRAIN
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '4px', fontWeight: 700 }}>MONOTONY</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: (stats.training_details.monotony || 0) > 2 ? '#ef4444' : themeColor }}>{stats.training_details.monotony || 0}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: '4px' }}>&lt;2 target</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '4px', fontWeight: 700 }}>WEEKLY STRAIN</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#8b5cf6' }}>{stats.training_details.weekly_stress || 0}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: '4px' }}>TRIMP × monotony</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '4px', fontWeight: 700 }}>REST DAYS (7D)</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: (stats.training_details.rest_days_7d || 0) < 1 ? '#ef4444' : '#10b981' }}>{stats.training_details.rest_days_7d ?? '—'}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: '4px' }}>of 7 days</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '4px', fontWeight: 700 }}>WEEKLY TRIMP</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b' }}>{stats.training_details.weekly_stress || 0}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: '4px' }}>training impulse</div>
                </div>
              </div>
              <div style={{ marginTop: '1rem', fontSize: '0.7rem', opacity: 0.4, padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                💡 Monotony &gt;2.0 with high strain = elevated injury risk. Vary session intensity and include recovery days.
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Widget A: 12-Week Consistency Score */}
            <div className="platform-card" style={{ padding: '2rem' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                  <BarChart2 size={20} color={themeColor} style={{ flexShrink: 0 }} /> 12-WEEK CONSISTENCY
                </h3>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: `${themeColor}22`,
                  color: themeColor
                }}>{consistencyPct}% CONSISTENT</span>
              </div>
              <div style={{ height: '200px', width: '100%', marginTop: '1rem' }}>
                <ResponsiveContainer>
                  <BarChart data={weekBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 7]} stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(v) => [`${v} active days`, '']}
                    />
                    <ReferenceLine y={3} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                    <Bar dataKey="activeDays" fill={themeColor} radius={[4, 4, 0, 0]} name="Active Days" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '0.5rem', textAlign: 'center' }}>
                Dashed line = 3-day threshold · {consistentWeeks}/12 weeks met target
              </div>
            </div>

            {/* Widget B: RPE Trend */}
            <div className="platform-card" style={{ padding: '2rem' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                  <Percent size={20} color={secondaryColor} style={{ flexShrink: 0 }} /> RELATIVE EFFORT TREND (RPE)
                </h3>
              </div>
              <div style={{ height: '200px', width: '100%', marginTop: '1rem' }}>
                <ResponsiveContainer>
                  <AreaChart data={rpeWeeks}>
                    <defs>
                      <linearGradient id="rpeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(v) => v != null ? [`${v}%`, 'Avg RPE'] : ['—', 'Avg RPE']}
                    />
                    <Area
                      type="monotone"
                      dataKey="rpe"
                      stroke={secondaryColor}
                      strokeWidth={2}
                      fill="url(#rpeGradient)"
                      connectNulls
                      name="RPE"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '0.5rem', textAlign: 'center' }}>
                Based on last 30 activities grouped by week · HR%-based when available
              </div>
            </div>
          </div>
          </>
        );
      })()}

      {/* HR Recovery / Aerobic Efficiency Trend */}
      {stats.hr_recovery && stats.hr_recovery.length > 2 && (() => {
        const hrData = stats.hr_recovery.slice(-18);
        return (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', opacity: 0.4, whiteSpace: 'nowrap' }}>AEROBIC EFFICIENCY</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* HR % Trend */}
            <div className="platform-card" style={{ padding: '2rem' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                  <Heart size={20} color="#ef4444" style={{ flexShrink: 0 }} /> AVG HR % OF MAX (MONTHLY)
                </h3>
              </div>
              <div style={{ height: '220px', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hrData}>
                    <defs>
                      <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false}
                      tickFormatter={(v) => v.slice(2)} interval="preserveStartEnd" />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false} unit="%" domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(v) => [`${v}%`, 'Avg HR % of max']}
                    />
                    <Area type="monotone" dataKey="hr_pct" stroke="#ef4444" strokeWidth={2}
                      fill="url(#hrGradient)" dot={{ fill: '#ef4444', r: 2 }} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: '0.65rem', opacity: 0.35, marginTop: '0.5rem', textAlign: 'center' }}>
                Lower trend = improving aerobic fitness (heart working less for same effort)
              </div>
            </div>

            {/* HR Efficiency Trend */}
            <div className="platform-card" style={{ padding: '2rem' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                  <TrendingUp size={20} color={themeColor} style={{ flexShrink: 0 }} /> AEROBIC EFFICIENCY (KM / %HR)
                </h3>
              </div>
              <div style={{ height: '220px', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hrData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false}
                      tickFormatter={(v) => v.slice(2)} interval="preserveStartEnd" />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(v) => [v, 'km per %HR']}
                    />
                    <Line type="monotone" dataKey="hr_efficiency" stroke={themeColor} strokeWidth={2.5}
                      dot={{ fill: themeColor, r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: '0.65rem', opacity: 0.35, marginTop: '0.5rem', textAlign: 'center' }}>
                Higher trend = aerobic engine improving — more output per heartbeat
              </div>
            </div>
          </div>
          </>
        );
      })()}

      {/* Seasonal Performance (天气/季节-表现相关性) */}
      {stats.seasonal_performance && stats.seasonal_performance.length > 0 && (() => {
        const seasons = stats.seasonal_performance;
        const seasonColors = { 'Q1 Winter': '#06b6d4', 'Q2 Spring': '#10b981', 'Q3 Summer': '#f59e0b', 'Q4 Autumn': '#f97316' };
        const seasonEmoji = { 'Q1 Winter': '❄️', 'Q2 Spring': '🌸', 'Q3 Summer': '☀️', 'Q4 Autumn': '🍂' };
        const maxDist = Math.max(...seasons.map(s => s.distance), 1);
        return (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', opacity: 0.4, whiteSpace: 'nowrap' }}>SEASONAL PERFORMANCE</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                <Sun size={20} color="#f59e0b" style={{ flexShrink: 0 }} /> PERFORMANCE BY SEASON
              </h3>
              <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>Volume & best pace per quarter</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginTop: '1.5rem' }}>
              {seasons.map(s => {
                const color = seasonColors[s.quarter] || '#fff';
                const pct = (s.distance / maxDist) * 100;
                return (
                  <div key={s.quarter} style={{ textAlign: 'center', padding: '1.25rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderTop: `3px solid ${color}` }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{seasonEmoji[s.quarter]}</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, marginBottom: '8px' }}>{s.quarter}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color, lineHeight: 1 }}>{s.distance}</div>
                    <div style={{ fontSize: '0.55rem', opacity: 0.4, marginBottom: '8px' }}>km total</div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.8s' }} />
                    </div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{s.count} sessions</div>
                    {s.best_5k_pace && (
                      <div style={{ marginTop: '6px', padding: '3px 6px', background: `${color}20`, borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, color }}>
                        Best 5K: {s.best_5k_pace}/km
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </>
        );
      })()}

      {/* Training DNA Card */}
      {stats.training_dna && (() => {
        const dna = stats.training_dna;
        const gradeColor = dna.consistency_grade === 'A' ? '#10b981' : dna.consistency_grade === 'B' ? '#06b6d4' : dna.consistency_grade === 'C' ? '#f59e0b' : '#ef4444';
        return (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', opacity: 0.4, whiteSpace: 'nowrap' }}>ATHLETE IDENTITY</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div className="platform-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                <Dna size={18} color="#ec4899" style={{ flexShrink: 0 }} /> TRAINING DNA
              </h3>
              <span style={{ fontSize: '0.7rem', fontWeight: 900, padding: '3px 12px', borderRadius: '999px', background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}>
                {dna.style}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'SPORT', value: dna.dominant_sport, color: themeColor },
                { label: 'FAVE DAY', value: dna.fav_day?.slice(0, 3).toUpperCase(), color: '#f59e0b' },
                { label: 'TIME SLOT', value: dna.time_label, color: '#8b5cf6', small: true },
                { label: 'AVG DISTANCE', value: `${dna.avg_distance} km`, color: '#10b981' },
                { label: 'YEARS ACTIVE', value: dna.years_active, color: '#06b6d4' },
                { label: 'CONSISTENCY', value: dna.consistency_grade, color: gradeColor },
              ].map(d => (
                <div key={d.label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.5rem', opacity: 0.5, fontWeight: 800, letterSpacing: '0.5px', marginBottom: '4px' }}>{d.label}</div>
                  <div style={{ fontSize: d.small ? '0.8rem' : '1.1rem', fontWeight: 900, color: d.color, lineHeight: 1.2 }}>{d.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1rem', fontSize: '0.65rem', opacity: 0.35, textAlign: 'center' }}>
              {dna.total_activities} total activities · {dna.consistency_pct}% weekly consistency
            </div>
          </div>
          </>
        );
      })()}

    </motion.div>
  );
};

export default Analytics;
