import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, MapPin, TrendingUp, Calendar, Zap, Activity, Heart, Footprints, Flame, ExternalLink, Mountain } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, LineChart, Line, BarChart, Bar, Cell } from 'recharts';

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
};

const calculateVO2Max = (records) => {
    // Simple Cooper test estimate based on 10K or 5K best pace
    if (records["5K"]) {
        const dist = 5.0; // km
        const timeStr = records["5K"].moving_time;
        const timeOnly = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
        const parts = timeOnly.split(':');
        const timeInMin = parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2])/60;
        // Using a simplified formula
        return (22.351 * (dist / (timeInMin / 12)) - 11.288).toFixed(1);
    }
    return 45.0; // Default fallback
};

const predictRace = (baseTimeSec, baseDist, targetDist, exponent = 1.06) => {
    // Riegel's formula: T2 = T1 * (D2/D1)^exponent
    const predictedSec = baseTimeSec * Math.pow(targetDist / baseDist, exponent);
    return formatTime(Math.round(predictedSec));
};

const Records = ({ stats, setActiveTab, setInitialSearch, sportType }) => {
  const isGlobalFilterActive = sportType !== 'All';
  const [internalSportMode, setInternalSportMode] = useState('Run');
  const [pageTab, setPageTab] = useState('records');

  const sportMode = isGlobalFilterActive ? sportType : internalSportMode;
  const tabColor = sportMode === 'Run' ? '#ff3366' : 'var(--accent-cyan)';

  if (!stats) return null;

  const predictorConfigs = {
    'Run': {
      targets: [
        { label: '5K', dist: 5 },
        { label: '10K', dist: 10 },
        { label: 'Half Marathon', dist: 21.1 },
        { label: 'Marathon', dist: 42.2 }
      ],
      baseKey: "5K",
      fallbackKey: "10K",
      defaultBaseDist: 5,
      exponent: stats.athlete_metrics?.riegel_exponents?.run || 1.06,
      color: "#ff3366"
    },
    'Ride': {
      targets: [
        { label: '40K TT', dist: 40 },
        { label: '100K Century', dist: 100 },
        { label: '160K Imperial', dist: 160.9 },
        { label: '200K Brevet', dist: 200 }
      ],
      baseKey: "30K Ride",
      fallbackKey: "50K Ride",
      defaultBaseDist: 30,
      exponent: stats.athlete_metrics?.riegel_exponents?.ride || 1.05,
      color: "var(--accent-cyan)"
    }
  };

  const currentConfig = predictorConfigs[sportMode] || predictorConfigs['Run'];
  const baseRecord = stats.records[currentConfig.baseKey] || stats.records[currentConfig.fallbackKey];
  const baseDist = stats.records[currentConfig.baseKey] ? currentConfig.defaultBaseDist : (stats.records[currentConfig.fallbackKey] ? (currentConfig.defaultBaseDist * 2.5) : currentConfig.defaultBaseDist);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content"
    >
      {/* TAB BUTTONS */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
        {[['records', 'RECORDS'], ['physiology', 'PHYSIOLOGY'], ['predictor', 'RACE PREDICTOR']].map(([key, label]) => (
          <button key={key} onClick={() => setPageTab(key)} style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.75rem',
            border: pageTab === key ? `1px solid ${tabColor}` : '1px solid transparent',
            background: pageTab === key ? `${tabColor}33` : 'var(--bg-card)',
            color: 'white', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '1px', cursor: 'pointer'
          }}>{label}</button>
        ))}
      </div>

      {/* SPORT MODE TOGGLE (moved from inside Predictor section) */}
      {!isGlobalFilterActive && (
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '2rem', width: 'fit-content' }}>
          {['Run', 'Ride'].map(type => (
            <button key={type} onClick={() => setInternalSportMode(type)} style={{
              padding: '6px 16px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
              background: sportMode === type ? (type === 'Run' ? '#ff3366' : 'var(--accent-cyan)') : 'transparent',
              color: sportMode === type ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s'
            }}>{type === 'Run' ? 'RUN' : 'RIDE'}</button>
          ))}
        </div>
      )}

      {/* TAB 1: RECORDS */}
      {pageTab === 'records' && (
        <>
          {/* Row 1: PB Milestones + Peak Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* COLUMN 1: ALL-TIME RECORDS (THE MEDAL WALL) */}
            <div className="platform-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1.5rem', opacity: 0.8, letterSpacing: '1px' }}>PERSONAL BEST MILESTONES</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', flex: 1 }}>
                {Object.entries(stats.records || {})
                  .filter(([name]) => sportMode === 'Ride' ? name.includes('Ride') : !name.includes('Ride'))
                  .slice(0, 4)
                  .map(([name, data]) => {
                    const isRun = !name.includes('Ride');
                    const accentColor = isRun ? '#ff3366' : 'var(--accent-cyan)';
                    return (
                    <div
                      key={name}
                      onClick={() => { if (setActiveTab && setInitialSearch) { setInitialSearch(data.name); setActiveTab('Activities'); } }}
                      style={{
                          padding: '1rem',
                          borderRadius: '12px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderLeft: `3px solid ${accentColor}`,
                          position: 'relative',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <span style={{ fontSize: '0.6rem', fontWeight: 900, opacity: 0.7 }}>{name.replace(' Ride', '')}</span>
                          <Trophy size={12} color={accentColor} />
                      </div>
                      <div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white' }}>{data.moving_time}</div>
                          <div style={{ fontSize: '0.7rem', color: accentColor, fontWeight: 700 }}>{data.pace}</div>
                      </div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '4px' }}>{data.start_date_local?.split(' ')[0] || '—'}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* COLUMN 2: PEAK PERFORMANCE MATRIX */}
            <div className="platform-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1.5rem', opacity: 0.8, letterSpacing: '1px' }}>PEAK EFFORTS MATRIX</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '1rem', flex: 1 }}>
                    <div style={{ background: `${sportMode === 'Run' ? '#ff3366' : 'var(--accent-cyan)'}11`, padding: '1rem', borderRadius: '12px', border: `1px solid ${sportMode === 'Run' ? '#ff3366' : 'var(--accent-cyan)'}22` }}>
                        <div style={{ fontSize: '0.6rem', opacity: 0.8, marginBottom: '4px' }}>{sportMode === 'Run' ? 'PEAK SPEED' : 'MAX AVG POWER'}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: sportMode === 'Run' ? '#ff3366' : 'var(--accent-cyan)' }}>
                            {sportMode === 'Run' ? stats.athlete_metrics?.peak_performance?.running?.max_speed : stats.athlete_metrics?.peak_performance?.cycling?.max_avg_power}
                            <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>{sportMode === 'Run' ? 'km/h' : 'W'}</span>
                        </div>
                    </div>
                    <div style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                        <div style={{ fontSize: '0.6rem', opacity: 0.8, marginBottom: '4px' }}>{sportMode === 'Run' ? 'MAX CADENCE' : 'MAX SPEED'}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#8b5cf6' }}>
                            {sportMode === 'Run' ? stats.athlete_metrics?.peak_performance?.running?.max_cadence : stats.athlete_metrics?.peak_performance?.cycling?.max_speed}
                            <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>{sportMode === 'Run' ? 'spm' : 'km/h'}</span>
                        </div>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.1)', gridColumn: 'span 2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '0.6rem', opacity: 0.8, marginBottom: '4px' }}>YEARLY BREAKTHROUGHS</div>
                              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>
                                  {stats.athlete_metrics?.peak_performance?.milestones?.pbs_this_year}
                                  <span style={{ fontSize: '0.8rem', marginLeft: '8px', opacity: 0.7 }}>NEW PBs IN {new Date().getFullYear()}</span>
                              </div>
                            </div>
                            <TrendingUp color="#f59e0b" size={24} style={{ opacity: 0.2 }} />
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* Row 2: PR Timeline + World Record Comparison */}
          {(() => {
            const WR = {
              Run: { '5K': 757, '10K': 1572, 'Half Marathon': 3385, 'Marathon': 7121 },
              Ride: { '40K TT': 2937, '100K Century': 7920, '160K Imperial': 14400, '200K Brevet': 21600 }
            };

            const modeWR = WR[sportMode] || WR['Run'];
            const trends = stats.records_trends || {};

            // Find most-improved record for current sport mode
            const filteredTrendEntries = Object.entries(trends).filter(([name]) =>
              sportMode === 'Ride' ? name.includes('Ride') : !name.includes('Ride')
            );
            const mostImprovedEntry = filteredTrendEntries.sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0))[0];
            const prTimelineData = mostImprovedEntry
              ? [...(mostImprovedEntry[1] || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))
              : [];

            // World record comparison: get user best for each WR key
            const wrRows = Object.entries(modeWR).map(([label, wrSec]) => {
              const matchKey = Object.keys(stats.records || {}).find(k => {
                const kClean = k.replace(' Ride', '').toLowerCase();
                const lClean = label.toLowerCase();
                return kClean === lClean || lClean.includes(kClean) || kClean.includes(lClean);
              });
              const recordData = matchKey ? stats.records[matchKey] : null;
              let userSec = null;
              if (recordData?.moving_time) {
                const t = recordData.moving_time.includes(' ')
                  ? recordData.moving_time.split(' ')[1]
                  : recordData.moving_time;
                const parts = t.split(':');
                userSec = (parseInt(parts[0])||0)*3600 + (parseInt(parts[1])||0)*60 + (parseInt(parts[2])||0);
              }
              const pct = userSec ? Math.round((userSec / wrSec) * 100) : null;
              const color = pct == null ? 'rgba(255,255,255,0.3)' : pct < 150 ? '#10b981' : pct < 200 ? '#f59e0b' : '#f97316';
              return { label, wrSec, userSec, pct, userTime: recordData?.moving_time, color };
            });

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* PR Timeline Widget */}
                <div className="platform-card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1rem', opacity: 0.8, letterSpacing: '1px' }}>PERSONAL BEST PROGRESSION</h2>
                  {mostImprovedEntry && prTimelineData.length > 1 ? (
                    <>
                      <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '1rem' }}>
                        {mostImprovedEntry[0].replace(' Ride', '')} — {prTimelineData.length} recorded bests
                      </div>
                      <div style={{ height: '200px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={prTimelineData} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                              dataKey="date"
                              stroke="rgba(255,255,255,0.3)"
                              fontSize={10}
                              tickFormatter={(v) => String(v)}
                            />
                            <YAxis
                              dataKey="seconds"
                              stroke="rgba(255,255,255,0.3)"
                              fontSize={10}
                              tickFormatter={(v) => {
                                const m = Math.floor(v / 60);
                                const s = Math.floor(v % 60);
                                return `${m}:${s.toString().padStart(2,'0')}`;
                              }}
                              reversed={true}
                              width={45}
                            />
                            <Tooltip
                              contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                              formatter={(v) => {
                                const m = Math.floor(v / 60);
                                const s = Math.floor(v % 60);
                                return [`${m}:${s.toString().padStart(2,'0')}`, 'Time'];
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="seconds"
                              stroke={currentConfig.color}
                              strokeWidth={2}
                              dot={{ fill: currentConfig.color, r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                      <TrendingUp size={36} style={{ marginBottom: '1rem' }} />
                      <p style={{ fontSize: '0.8rem', textAlign: 'center' }}>Record multiple PBs to see progression over time.</p>
                    </div>
                  )}
                </div>

                {/* World Record Comparison */}
                <div className="platform-card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1rem', opacity: 0.8, letterSpacing: '1px' }}>WORLD RECORD COMPARISON</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ opacity: 0.5 }}>
                        <th style={{ textAlign: 'left', paddingBottom: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>RECORD</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.75rem', fontWeight: 700 }}>YOUR BEST</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.75rem', fontWeight: 700 }}>WR</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.75rem', fontWeight: 700 }}>YOUR %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wrRows.map(({ label, wrSec, pct, userTime, color }) => (
                        <tr key={label} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>{label}</td>
                          <td style={{ textAlign: 'right', padding: '0.6rem 0', color: currentConfig.color, fontWeight: 800 }}>
                            {userTime ? (userTime.includes(' ') ? userTime.split(' ')[1].split('.')[0] : userTime.split('.')[0]) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '0.6rem 0', opacity: 0.5 }}>{formatTime(wrSec)}</td>
                          <td style={{ textAlign: 'right', padding: '0.6rem 0' }}>
                            <span style={{ color, fontWeight: 800 }}>{pct != null ? `${pct}%` : '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.6rem', opacity: 0.4 }}>
                    <span style={{ color: '#10b981' }}>● &lt;150% excellent</span>
                    <span style={{ color: '#f59e0b' }}>● 150–200% good</span>
                    <span style={{ color: '#f97316' }}>● &gt;200% improving</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Personal Records per Month */}
          {stats.pbs_per_month && stats.pbs_per_month.length > 0 && (() => {
            const last18 = stats.pbs_per_month.slice(-18);
            return (
              <div className="platform-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1rem', opacity: 0.8, letterSpacing: '1px' }}>PERSONAL RECORDS SET PER MONTH</h2>
                <div style={{ height: '160px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={last18} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        formatter={(v) => [`${v} new PB${v !== 1 ? 's' : ''}`, 'Month']}
                      />
                      <Line type="monotone" dataKey="pbs" stroke={currentConfig.color} strokeWidth={2.5} dot={{ fill: currentConfig.color, r: 4 }} activeDot={{ r: 6 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '0.5rem', textAlign: 'center' }}>
                  Months where a new all-time best was set for 5K, 10K, Half Marathon, or Marathon
                </div>
              </div>
            );
          })()}

          {/* Elevation Trophy Wall */}
          {stats.elevation_trophies && (stats.elevation_trophies.top_activities?.length > 0) && (
            <div className="platform-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.8, letterSpacing: '1px' }}>
                  <span style={{ marginRight: '8px' }}>⛰️</span>ELEVATION TROPHY WALL
                </h2>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.7rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 900, color: '#10b981', fontSize: '1.2rem' }}>{(stats.elevation_trophies.best_week_elev || 0).toLocaleString()}m</div>
                    <div style={{ opacity: 0.4, fontSize: '0.6rem' }}>BEST WEEK</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 900, color: '#f59e0b', fontSize: '1.2rem' }}>{(stats.elevation_trophies.best_month_elev || 0).toLocaleString()}m</div>
                    <div style={{ opacity: 0.4, fontSize: '0.6rem' }}>BEST MONTH</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {stats.elevation_trophies.top_activities.map((act, idx) => {
                  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: idx === 0 ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', borderLeft: idx === 0 ? '3px solid #f59e0b' : '3px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{medals[idx]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.name}</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{act.date} · {act.distance} km</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: currentConfig.color }}>+{act.elevation.toLocaleString()}m</div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{act.type}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Monthly trend sparkline */}
              {stats.elevation_trophies.monthly_trend?.length > 0 && (
                <div style={{ marginTop: '1.25rem', height: '80px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.elevation_trophies.monthly_trend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <XAxis dataKey="month" hide />
                      <Tooltip
                        contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '10px' }}
                        formatter={(v) => [`${v.toLocaleString()}m`, 'Elevation']}
                      />
                      <Bar dataKey="elevation" radius={[2, 2, 0, 0]}>
                        {stats.elevation_trophies.monthly_trend.map((_, i) => (
                          <Cell key={i} fill={i === stats.elevation_trophies.monthly_trend.length - 1 ? currentConfig.color : `${currentConfig.color}44`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: '0.6rem', opacity: 0.3, textAlign: 'center', marginTop: '2px' }}>Monthly elevation (last 12 months)</div>
                </div>
              )}
            </div>
          )}

          {/* Pace Evolution Timeline */}
          {stats.pace_evolution && Object.keys(stats.pace_evolution).length > 0 && (() => {
            const distances = Object.keys(stats.pace_evolution).filter(k =>
              sportMode === 'Run' ? true : false
            );
            if (distances.length === 0) return null;
            const distColors = { '5K': '#ff3366', '10K': '#f59e0b', 'Half': '#10b981', 'Marathon': '#8b5cf6' };
            // Merge all months across distances
            const allMonths = [...new Set(distances.flatMap(d => stats.pace_evolution[d].map(p => p.month)))].sort();
            const chartData = allMonths.map(month => {
              const entry = { month };
              distances.forEach(d => {
                const pt = stats.pace_evolution[d].find(p => p.month === month);
                if (pt) entry[d] = pt.pace_sec;
              });
              return entry;
            });
            return (
              <div className="platform-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.8, letterSpacing: '1px' }}>PACE EVOLUTION TIMELINE</h2>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.6rem' }}>
                    {distances.map(d => (
                      <span key={d} style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.7 }}>
                        <span style={{ width: '8px', height: '2px', background: distColors[d] || '#fff', display: 'inline-block' }} />
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 20, left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false}
                        tickFormatter={(v) => v.slice(2)} interval="preserveStartEnd" />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false}
                        reversed={true}
                        tickFormatter={(v) => `${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}`}
                        width={38}
                      />
                      <Tooltip
                        contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                        formatter={(v, name) => [`${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}/km`, name]}
                      />
                      {distances.map(d => (
                        <Line key={d} type="monotone" dataKey={d} stroke={distColors[d] || '#fff'} strokeWidth={2}
                          dot={false} activeDot={{ r: 4 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '0.5rem', textAlign: 'center' }}>
                  Monthly best pace per distance — lower line = faster pace
                </div>
              </div>
            );
          })()}

          <h2 className="category-title" style={{ marginBottom: '2rem' }}>Performance Progress Tracking</h2>
          {Object.keys(stats.records_trends || {}).length > 0 ? (
            <div className="platform-grid">
              {(Object.entries(stats.records_trends || {})).map(([name, data]) => (
                <div key={name} className="platform-card interactive-card" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={18} color={sportMode === 'Run' ? '#ff3366' : 'var(--accent-cyan)'} /> {name.toUpperCase()} HISTORIC
                  </h3>
                  <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer>
                      <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          name="Year"
                          stroke="rgba(255,255,255,0.3)"
                          fontSize={10}
                          tickFormatter={(str) => str}
                        />
                        <YAxis
                          dataKey="seconds"
                          name="Time"
                          stroke="rgba(255,255,255,0.3)"
                          fontSize={10}
                          tickFormatter={formatTime}
                          reversed={true}
                        />
                        <ZAxis range={[60, 60]} />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                          labelStyle={{ color: 'var(--accent-cyan)' }}
                          formatter={(val, name) => [name === 'Time' ? formatTime(val) : val, name]}
                        />
                        <Scatter
                          name={name}
                          data={data}
                          fill={sportMode === 'Run' ? '#ff3366' : 'var(--accent-cyan)'}
                          fillOpacity={0.6}
                          line={{ stroke: sportMode === 'Run' ? '#ff336644' : 'rgba(6, 182, 212, 0.2)', strokeWidth: 1 }}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <p style={{ marginTop: '1rem', opacity: 0.7, fontSize: '0.7rem' }}>
                      Each dot is the best {name.replace(' Ride', '')} time for that year. Higher position means faster.
                  </p>

                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.8rem', letterSpacing: '1px' }}>ALL-TIME RANKING</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[...data].sort((a,b) => a.seconds - b.seconds).slice(0, 5).map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ color: idx === 0 ? '#ffd700' : (idx === 1 ? '#c0c0c0' : '#cd7f32'), fontWeight: 900 }}>{idx + 1}</span>
                                      <span style={{ opacity: 0.7 }}>{item.date}</span>
                                  </span>
                                  <b style={{ color: sportMode === 'Run' ? '#ff3366' : 'var(--accent-cyan)' }}>{formatTime(item.seconds)}</b>
                              </div>
                          ))}
                      </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="platform-card" style={{ padding: '4rem', textAlign: 'center', opacity: 0.7 }}>
               <Activity size={48} style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
               <p>Performance trends require multiple activities around the target distances.</p>
            </div>
          )}
        </>
      )}

      {/* TAB 2: PHYSIOLOGY */}
      {pageTab === 'physiology' && (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* VO2 Max card */}
          {(() => {
            const vo2 = parseFloat(stats.athlete_metrics?.vo2_estimate || calculateVO2Max(stats.records)) || 45;
            const vo2Pct = Math.min(100, Math.max(0, ((vo2 - 30) / 50) * 100));
            const vo2Label = vo2 >= 60 ? 'Superior' : vo2 >= 52 ? 'Excellent' : vo2 >= 44 ? 'Good' : vo2 >= 38 ? 'Fair' : 'Developing';
            return (
              <div className="platform-card" style={{ padding: '1.2rem', background: `linear-gradient(135deg, ${sportMode === 'Run' ? '#ff336622' : 'rgba(6,182,212,0.1)'}, rgba(189, 0, 255, 0.1))` }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.8, marginBottom: '0.2rem' }}>ESTIMATED VO₂ MAX</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'white' }}>{vo2}</div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '0.5rem' }}>
                  <div style={{ height: '100%', width: `${vo2Pct}%`, background: sportMode === 'Run' ? '#ff3366' : 'var(--accent-cyan)', borderRadius: '2px', transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '4px' }}>{vo2Label} · ml/kg/min</div>
              </div>
            );
          })()}

          {/* HR Zones card */}
          <div className="platform-card" style={{ padding: '1.2rem' }}>
              <h3 style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '1rem', opacity: 0.8 }}>HR ZONES</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(stats.athlete_metrics?.zones || {}).slice(0, 5).map(([zone, range], idx) => (
                      <div key={zone} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '3px', height: '10px', background: ['#94a3b8', '#34d399', '#f59e0b', '#ef4444', '#7c3aed'][idx] }} />
                            <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>Z{idx+1}</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{range.from}-{range.to || 'max'}</span>
                      </div>
                  ))}
              </div>
          </div>

          {/* Threshold/FTP card */}
          <div className="platform-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(to bottom, rgba(139, 92, 246, 0.05), transparent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.8 }}>
                        {sportMode === 'Run' ? 'THRESHOLD PACE' : 'ESTIMATED FTP'}
                    </h3>
                    <Zap size={18} color="#8b5cf6" />
                </div>
                <div style={{ fontSize: sportMode === 'Run' ? '2.6rem' : '3rem', fontWeight: 900, color: '#8b5cf6', lineHeight: 1 }}>
                    {sportMode === 'Run' ? stats.athlete_metrics?.threshold_pace || '--' : stats.athlete_metrics?.ftp_estimate || 0}
                    <span style={{ fontSize: '1rem', opacity: 0.7, marginLeft: '4px' }}>
                        {sportMode === 'Run' ? '/km' : 'W'}
                    </span>
                </div>
                <p style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '1rem' }}>
                    {sportMode === 'Run'
                        ? 'Estimated pace you can maintain for approx. 1 hour.'
                        : 'Functional Threshold Power based on performance data.'}
                </p>
          </div>
        </div>

        {/* Peak Power Curve (Ride) + FTP History */}
        {sportMode === 'Ride' && stats.power_history && stats.power_history.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Peak Power by Month from recent activities */}
            {(() => {
              const powerByMonth = {};
              (stats.recent_activities || []).forEach(a => {
                if ((a.average_watts || 0) > 0) {
                  const m = (a.start_date_local || '').slice(0, 7);
                  if (m && (!powerByMonth[m] || a.average_watts > powerByMonth[m])) {
                    powerByMonth[m] = a.average_watts;
                  }
                }
              });
              const powerData = Object.entries(powerByMonth)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-18)
                .map(([month, watts]) => ({ month: month.slice(2), watts: Math.round(watts) }));
              if (powerData.length === 0) return null;
              return (
                <div className="platform-card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1rem', opacity: 0.8, letterSpacing: '1px' }}>
                    MONTHLY PEAK POWER CURVE
                  </h3>
                  <div style={{ height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={powerData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false} unit="W" />
                        <Tooltip
                          contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                          formatter={(v) => [`${v} W`, 'Peak Avg Power']}
                        />
                        <Bar dataKey="watts" radius={[4, 4, 0, 0]}>
                          {powerData.map((_, i) => (
                            <Cell key={i} fill={i === powerData.length - 1 ? 'var(--accent-cyan)' : 'rgba(6,182,212,0.35)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '0.5rem', textAlign: 'center' }}>
                    Monthly best average wattage from all ride activities
                  </div>
                </div>
              );
            })()}

            {/* FTP History */}
            <div className="platform-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1rem', opacity: 0.8, letterSpacing: '1px' }}>
                FTP HISTORY (ANNUAL)
              </h3>
              <div style={{ height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.power_history} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="year" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} unit="W" />
                    <Tooltip
                      contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(v, name) => [`${v} W`, name === 'ftp_estimate' ? 'Est. FTP (95%)' : 'Best Avg Power']}
                    />
                    <Line type="monotone" dataKey="best_watts" stroke="rgba(6,182,212,0.5)" strokeWidth={1.5}
                      dot={{ fill: 'rgba(6,182,212,0.5)', r: 3 }} name="best_watts" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="ftp_estimate" stroke="var(--accent-cyan)" strokeWidth={2.5}
                      dot={{ fill: 'var(--accent-cyan)', r: 4 }} activeDot={{ r: 6 }} name="ftp_estimate" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.6rem', opacity: 0.5, justifyContent: 'center' }}>
                <span>── Best Avg Power &nbsp;&nbsp;— — FTP estimate (95%)</span>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {/* TAB 3: PREDICTOR */}
      {pageTab === 'predictor' && (
        <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
              <Clock size={18} color="#f59e0b" /> {sportMode.toUpperCase()} PERFORMANCE PREDICTOR
            </h3>
          </div>

          {/* Base record indicator */}
          <div style={{ marginBottom: '1.5rem', fontSize: '0.7rem', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {baseRecord ? (
              <>Based on your <b style={{ opacity: 0.9 }}>{currentConfig.baseKey || currentConfig.fallbackKey}</b> PB:
              <span style={{ color: currentConfig.color, fontWeight: 800 }}>
                {(baseRecord.moving_time?.includes(' ') ? baseRecord.moving_time.split(' ')[1] : baseRecord.moving_time)?.split('.')[0]}
              </span></>
            ) : (
              <span style={{ color: '#f59e0b' }}>⚠ No base record found — record a {currentConfig.baseKey} to improve accuracy</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
              {currentConfig.targets.map(race => {
                  const timeStr = baseRecord?.moving_time || (sportMode === 'Run' ? '00:20:00' : '01:00:00');
                  const timeOnly = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
                  const baseParts = timeOnly.split(':');
                  const baseSec = (parseInt(baseParts[0])||0)*3600 + (parseInt(baseParts[1])||0)*60 + (parseInt(baseParts[2])||0);
                  return (
                    <div key={race.label} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: '0.5rem', fontWeight: 700 }}>{race.label}</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: currentConfig.color }}>
                            {predictRace(baseSec, baseDist, race.dist, currentConfig.exponent)}
                        </div>
                        {!baseRecord && <div style={{ fontSize: '0.65rem', opacity: 0.3, marginTop: '4px' }}>est.</div>}
                    </div>
                  )
              })}
          </div>
        </div>
      )}

    </motion.div>
  );
};

export default Records;
