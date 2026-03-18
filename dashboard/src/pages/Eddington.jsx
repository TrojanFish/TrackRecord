import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Award, Info, ChevronRight, Activity } from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  CartesianGrid, ReferenceLine, Label 
} from 'recharts';

const Eddington = ({ stats, sportType }) => {
  // Use global sportType if it's Run or Ride, otherwise fallback to internal state
  const isGlobalFilterActive = sportType !== 'All';
  const [internalActiveType, setInternalActiveType] = useState('Run');
  
  const activeType = isGlobalFilterActive ? sportType : internalActiveType;

  if (!stats || !stats.eddington) return null;

  const currentData = stats.eddington[activeType] || { value: 0, next_gap: 0, chart_data: [] };
  const themeColor = activeType === 'Run' ? 'var(--accent-cyan)' : '#bd00ff';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content"
    >
      {/* Type Toggle - Only show if no global filter is active */}
      {!isGlobalFilterActive && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
            <button 
              onClick={() => setInternalActiveType('Run')}
              className={`platform-card ${activeType === 'Run' ? 'active' : ''}`}
              style={{ 
                padding: '1rem 2rem', 
                cursor: 'pointer',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.8rem',
                letterSpacing: '1px',
                border: activeType === 'Run' ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                background: activeType === 'Run' ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-card)'
              }}
            >
              RUNNING EDDINGTON
            </button>
            <button 
              onClick={() => setInternalActiveType('Ride')}
              className={`platform-card ${activeType === 'Ride' ? 'active' : ''}`}
              style={{ 
                padding: '1rem 2rem', 
                cursor: 'pointer',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.8rem',
                letterSpacing: '1px',
                border: activeType === 'Ride' ? '1px solid #bd00ff' : '1px solid transparent',
                background: activeType === 'Ride' ? 'rgba(189, 0, 255, 0.2)' : 'var(--bg-card)'
              }}
            >
              CYCLING EDDINGTON
            </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginBottom: '2rem', alignItems: 'stretch' }}>
        {/* Left: Summary Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
          <div className="platform-card stat-card interactive-card" style={{ 
            borderBottom: `4px solid ${themeColor}`,
            padding: '2.5rem'
          }}>
            <span className="stat-label">CURRENT EDDINGTON</span>
            <span className="stat-value" style={{ fontSize: '6rem' }}>E{currentData.value}</span>
            <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  padding: '10px', 
                  background: 'rgba(255,255,255,0.05)', 
                  borderRadius: '10px',
                  color: activeType === 'Run' ? 'var(--accent-cyan)' : '#bd00ff'
                }}>
                   <TrendingUp size={24} />
                </div>
                <div>
                   <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>NEXT LEVEL: E{currentData.value + 1}</div>
                   <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                      Need <b>{currentData.next_gap}</b> more days of {currentData.value + 1}+ km
                   </div>
                </div>
            </div>
          </div>

          <div className="platform-card" style={{ padding: '1.5rem', flex: 1 }}>
             <h4 style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Info size={16} opacity={0.5} /> WHAT IS E-NUMBER?
             </h4>
             <p style={{ fontSize: '0.8rem', opacity: 0.8, lineHeight: '1.6' }}>
                The Eddington number (E) is the maximum integer such that an athlete has cycled/run at least E kilometers on at least E separate days. 
                It measures both <b>consistency</b> and <b>intensity</b> over your entire history.
             </p>
          </div>
        </div>

        {/* Right: Stepped Frontier Chart */}
        <div className="platform-card" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} color="var(--accent-cyan)" /> EDDINGTON FRONTIER ANALYSIS
          </h3>
          <div style={{ height: '400px', width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={currentData.chart_data} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <defs>
                  <linearGradient id="eddingtonGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeType === 'Run' ? 'var(--accent-cyan)' : '#bd00ff'} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={activeType === 'Run' ? 'var(--accent-cyan)' : '#bd00ff'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="km" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={11}
                  label={{ value: 'Distance (km)', position: 'insideBottom', offset: -15, fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 600 }}
                  tick={{ fill: 'rgba(255,255,255,0.5)' }}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={12}
                  label={{ value: 'Number of Days', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                />
                <Tooltip 
                  contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                {/* The "Frontier" line: where days == km */}
                <Area 
                  type="stepAfter" 
                  dataKey="days" 
                  stroke={activeType === 'Run' ? 'var(--accent-cyan)' : '#bd00ff'} 
                  strokeWidth={3}
                  fill="url(#eddingtonGradient)" 
                  name="Days Achieved"
                />
                
                {/* The E-Number Line (slope 1) */}
                <Area 
                  type="monotone" 
                  dataKey="threshold" 
                  stroke="rgba(255,255,255,0.1)" 
                  fill="transparent" 
                  strokeDasharray="5 5"
                  name="E-Threshold"
                />

                <ReferenceLine 
                   x={currentData.value} 
                   stroke="rgba(255,255,255,0.2)" 
                   strokeDasharray="3 3"
                >
                   <Label value={`Current: E${currentData.value}`} position="top" fill="rgba(255,255,255,0.5)" fontSize={10} />
                </ReferenceLine>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', opacity: 0.5 }}>
                 <div style={{ width: '12px', height: '3px', background: activeType === 'Run' ? 'var(--accent-cyan)' : '#bd00ff' }} />
                 <span>Days with ≥ X km</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', opacity: 0.5 }}>
                 <div style={{ width: '12px', height: '1px', borderTop: '1px dashed rgba(255,255,255,0.3)' }} />
                 <span>Achievement Frontier (Days = KM)</span>
              </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Eddington;
