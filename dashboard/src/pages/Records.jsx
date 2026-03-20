import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, MapPin, TrendingUp, Calendar, Zap, Activity, Heart, Footprints, Flame, ExternalLink } from 'lucide-react';
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

const Records = ({ stats, setActiveTab, setInitialSearch, sportType }) => {
  const isGlobalFilterActive = sportType !== 'All';
  const [internalSportMode, setInternalSportMode] = useState('Run');
  
  const sportMode = isGlobalFilterActive ? sportType : internalSportMode;

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
      <div className="platform-grid-main">
          {/* LEFT: COMBINED PB + PEAK — side by side */}
          <div className="platform-grid-2col" style={{ gap: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
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
                        <div style={{ fontSize: '0.55rem', opacity: 0.6, marginTop: '4px' }}>{data.start_date_local?.split(' ')[0] || '—'}</div>
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

          {/* RIGHT: PHYSIOLOGY SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(() => {
                const vo2 = parseFloat(stats.athlete_metrics?.vo2_estimate || calculateVO2Max(stats.records)) || 45;
                // Typical range: 30 (untrained) to 80 (elite). Normalize to percentage.
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
              
              <div className="platform-card" style={{ padding: '1.2rem', flex: 1 }}>
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
          </div>
      </div>

      {/* SECOND ROW: PREDICTOR TRACKING */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 300px)', gap: '1.5rem', marginBottom: '3rem' }}>
          <div className="platform-card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
                  <Clock size={18} color="#f59e0b" /> {sportMode.toUpperCase()} PERFORMANCE PREDICTOR
                </h3>
                
                {!isGlobalFilterActive && (
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {['Run', 'Ride'].map(type => (
                      <button key={type} onClick={() => setInternalSportMode(type)} style={{
                          padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
                          background: sportMode === type ? (type === 'Run' ? '#ff3366' : 'var(--accent-cyan)') : 'transparent',
                          color: sportMode === type ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s'
                      }}> {type === 'Run' ? 'RUN' : 'RIDE'} </button>
                    ))}
                  </div>
                )}
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
                            {!baseRecord && <div style={{ fontSize: '0.55rem', opacity: 0.3, marginTop: '4px' }}>est.</div>}
                        </div>
                      )
                  })}
              </div>
          </div>

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

      <h2 className="category-title" style={{ marginBottom: '2rem' }}>Performance Progress Tracking</h2>
      {Object.keys(stats.records_trends || {}).length > 0 ? (
        <div className="platform-grid">
          {(Object.entries(stats.records_trends || {})).map(([name, data]) => (
            <div key={name} className="platform-card interactive-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
    </motion.div>
  );
};

export default Records;
