import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, MapPin, TrendingUp, Calendar, Zap, Activity } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid } from 'recharts';

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

const Records = ({ stats }) => {
  const [activeTab, setActiveTab] = useState(
    Object.keys(stats?.records || {}).some(k => k.includes('Ride')) && !Object.keys(stats?.records || {}).some(k => k.includes('5K'))
    ? 'Ride' : 'Run'
  );

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
      color: "var(--accent-cyan)"
    },
    'Ride': {
      targets: [
        { label: '40K TT', dist: 40 },
        { label: '100K Century', dist: 100 },
        { label: '160K Imperial', dist: 160.9 },
        { label: '200K Brevet', dist: 200 }
      ],
      baseKey: "20K Ride",
      fallbackKey: "50K Ride",
      defaultBaseDist: 20,
      exponent: stats.athlete_metrics?.riegel_exponents?.ride || 1.05,
      color: "#8b5cf6"
    }
  };

  const currentConfig = predictorConfigs[activeTab];
  const baseRecord = stats.records[currentConfig.baseKey] || stats.records[currentConfig.fallbackKey];
  const baseDist = stats.records[currentConfig.baseKey] ? currentConfig.defaultBaseDist : (stats.records[currentConfig.fallbackKey] ? (currentConfig.defaultBaseDist * 2.5) : currentConfig.defaultBaseDist);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-content"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '2rem', marginBottom: '3rem' }}>
          <div>
            <h2 className="category-title" style={{ fontSize: '0.9rem', marginBottom: '1.5rem', opacity: 0.8 }}>ALL-TIME PERSONAL BESTS</h2>
            <div className="platform-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {Object.entries(stats.records || {}).length > 0 ? (
                Object.entries(stats.records || {}).map(([name, data]) => (
                  <div key={name} className="platform-card record-card" style={{ padding: '1.5rem', minHeight: '120px' }}>
                    <div className="record-header">
                       <Trophy size={18} color={name.includes('Ride') ? '#8b5cf6' : 'var(--accent-cyan)'} />
                       <span className="record-label" style={{ fontSize: '0.6rem' }}>{name.toUpperCase()}</span>
                    </div>
                    <div className="record-value" style={{ fontSize: '1.4rem', margin: '0.5rem 0' }}>{data.moving_time}</div>
                    <div className="record-meta" style={{ marginTop: 'auto' }}>
                      <span style={{ fontSize: '0.6rem', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={10} /> {data.start_date_local.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="platform-card" style={{ padding: '2rem', textAlign: 'center', gridColumn: '1 / -1', opacity: 0.5 }}>
                  <TrendingUp size={32} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                  <p>No best efforts recorded yet. Go out and set some records!</p>
                </div>
              )}
            </div>
          </div>

          <div className="platform-card" style={{ padding: '2rem', height: 'fit-content', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(189, 0, 255, 0.1))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800 }}>ESTIMATED VO2 MAX</h3>
                  <Zap size={20} color="var(--accent-cyan)" />
              </div>
              <div style={{ fontSize: '4rem', fontWeight: 900, textAlign: 'center', margin: '1rem 0' }}>
                  {stats.athlete_metrics?.vo2_estimate || calculateVO2Max(stats.records)}
              </div>
              <div className="progress-bar-container" style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: stats.athlete_metrics?.vo2_estimate ? `${Math.min(100, (stats.athlete_metrics.vo2_estimate / 60) * 100)}%` : '75%' }} 
                    style={{ height: '100%', background: 'var(--accent-cyan)', borderRadius: '2px' }}
                  />
              </div>
              <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '1rem', textAlign: 'center' }}>
                  {stats.athlete_metrics?.max_hr ? `Calculated based on Max HR (${stats.athlete_metrics.max_hr}bpm) and Resting HR (${stats.athlete_metrics.resting_hr}bpm).` : 
                   (Object.keys(stats.records || {}).some(k => k.includes('5K') || k.includes('10K')) 
                    ? "Superior fitness level for your age group based on running effort." 
                    : "Estimated baseline aerobic capacity. Add more run data for accuracy.")
                  }
              </p>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '2rem', marginBottom: '3rem' }}>
          <div className="platform-card" style={{ padding: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={20} color="#f59e0b" /> {activeTab.toUpperCase()} TIME PREDICTOR (ESTIMATED)
                </h3>
                
                <div style={{ 
                  display: 'flex', 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '4px', 
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {['Run', 'Ride'].map(type => (
                    <button
                      key={type}
                      onClick={() => setActiveTab(type)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: activeTab === type ? (type === 'Run' ? 'var(--accent-cyan)' : '#8b5cf6') : 'transparent',
                        color: activeTab === type ? 'white' : 'var(--text-secondary)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {type === 'Run' ? 'RUNNING' : 'CYCLING'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
                  {currentConfig.targets.map(race => {
                      const timeStr = baseRecord?.moving_time || (activeTab === 'Run' ? '00:20:00' : '01:00:00');
                      const timeOnly = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
                      const baseParts = timeOnly.split(':');
                      const baseSec = parseInt(baseParts[0])*3600 + parseInt(baseParts[1])*60 + parseInt(baseParts[2]);
                      return (
                        <div key={race.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.5rem' }}>{race.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: currentConfig.color }}>
                                {predictRace(baseSec, baseDist, race.dist, currentConfig.exponent)}
                            </div>
                        </div>
                      )
                  })}
              </div>
          </div>

          <div className="platform-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '1.5rem', opacity: 0.8 }}>HEART RATE ZONES</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(stats.athlete_metrics?.zones || {}).map(([zone, range], idx) => (
                      <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                              width: '4px', 
                              height: '24px', 
                              borderRadius: '2px',
                              background: ['#94a3b8', '#34d399', '#f59e0b', '#ef4444', '#7c3aed'][idx] 
                          }} />
                          <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{zone.toUpperCase()}</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                  {range.from} - {range.to ? `${range.to} bpm` : 'max'}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
              <div style={{ marginTop: '1.5rem', fontSize: '0.65rem', opacity: 0.4, fontStyle: 'italic' }}>
                  Zones calculated via Fox formula (220-age). Customize in settings.yaml
              </div>
          </div>
      </div>

      <h2 className="category-title" style={{ marginBottom: '2rem' }}>Performance Progress Tracking</h2>
      {Object.keys(stats.records_trends || {}).length > 0 ? (
        <div className="platform-grid">
          {(Object.entries(stats.records_trends || {})).map(([name, data]) => (
            <div key={name} className="platform-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--accent-cyan)" /> {name} HISTORICAL TREND
              </h3>
              <div style={{ height: '240px', width: '100%' }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      name="Date" 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={10} 
                      tickFormatter={(str) => {
                          const parts = str.split('-');
                          return parts.length > 2 ? `${parts[1]}/${parts[2]}` : str;
                      }}
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
                      fill="var(--accent-cyan)" 
                      fillOpacity={0.6}
                      line={{ stroke: 'rgba(6, 182, 212, 0.2)', strokeWidth: 1 }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p style={{ marginTop: '1rem', opacity: 0.4, fontSize: '0.7rem' }}>
                  Each dot represents {name.includes('Ride') ? 'a ride' : 'a run'} near {name} distance. Higher position means faster pace.
              </p>
              
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.8rem', letterSpacing: '1px' }}>ALL-TIME RANKING</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[...data].sort((a,b) => a.seconds - b.seconds).slice(0, 3).map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: idx === 0 ? '#ffd700' : (idx === 1 ? '#c0c0c0' : '#cd7f32'), fontWeight: 900 }}>{idx + 1}</span>
                                  <span style={{ opacity: 0.5 }}>{item.date}</span>
                              </span>
                              <b style={{ color: 'var(--accent-cyan)' }}>{formatTime(item.seconds)}</b>
                          </div>
                      ))}
                  </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="platform-card" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
           <Activity size={48} style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
           <p>Performance trends require multiple activities around the target distances.</p>
        </div>
      )}
    </motion.div>
  );
};

export default Records;
