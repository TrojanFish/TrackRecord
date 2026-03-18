import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Legend, BarChart, Bar,
  PieChart, Pie, Cell, ComposedChart,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  Zap, Activity, TrendingUp, Trophy, ArrowRight,
  Calendar, Layers, Map, PieChart as PieIcon,
  Heart, Target, Zap as PowerIcon, ChevronRight, Speaker, Volume2, AlertCircle, Clock, Wrench,
  Footprints, Flame, Scale, User
} from 'lucide-react';

const COLORS = [
  '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#f43f5e', '#fbbf24', '#2dd4bf', '#6366f1', '#a855f7'
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

const Dashboard = ({ stats, setActiveTab, renderHeatmap, setInitialSearch }) => {
  const [showDetail, setShowDetail] = React.useState(false);
  const [detailType, setDetailType] = React.useState(null);
  const [heatMetric, setHeatMetric] = React.useState('count');
  const [panelTab, setPanelTab] = React.useState('history');
  
  const accent = stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)';
  const isRun = stats.sport_type === 'Run';

  const getACStatus = (ratio) => {
    if (ratio < 0.8) return { label: 'Low load', color: '#f59e0b' };
    if (ratio <= 1.3) return { label: 'Optimal', color: '#10b981' };
    if (ratio <= 1.5) return { label: 'High', color: '#f87171' };
    return { label: 'Danger', color: '#ef4444' };
  };

  const getTSBStatus = (val) => {
    if (val > 10) return { label: 'Race Ready', color: '#10b981' };
    if (val > 0) return { label: 'Fresh', color: '#34d399' };
    if (val > -10) return { label: 'Optimal', color: '#60a5fa' };
    if (val > -30) return { label: 'Productive', color: '#8b5cf6' };
    return { label: 'High Risk', color: '#ef4444' };
  };

  if (!stats) return null;

  const currentLoad = stats.training_load?.[stats.training_load.length - 1] || { ctl: 0, atl: 0, tsb: 0 };

  // Transform breakdown for PieChart
  const sportData = Object.entries(stats.breakdown || {}).map(([type, data]) => ({
    name: type,
    value: data.count,
    dist: (data.dist / 1000).toFixed(1)
  }));

  // Heatmap levels
  const getLevel = (count) => {
    if (!count) return 'level-0';
    if (count >= 4) return 'level-4';
    if (count >= 3) return 'level-3';
    if (count >= 2) return 'level-2';
    return 'level-1';
  };

  const renderActivityPattern = () => {
    if (!stats.activity_pattern || stats.activity_pattern.length === 0) return null;

    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const hours = Array.from({ length: 12 }, (_, i) => i * 2);

    // Find max value for color scaling
    const maxVal = Math.max(...stats.activity_pattern.map(p => p.value), 1);

    return (
      <div className="pattern-container">
        <div className="pattern-grid" style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '10px', marginTop: '10px' }}>
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(12, 1fr)', gap: '4px', fontSize: '0.6rem', opacity: 0.3, textAlign: 'right', paddingRight: '4px' }}>
          {hours.map(h => <div key={h}>{h}:00</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {days.map((day, dIdx) => (
            <div key={day} style={{ display: 'grid', gridTemplateRows: 'repeat(12, 1fr)', gap: '4px' }}>
              {hours.map((h, hIdx) => {
                const cell = stats.activity_pattern.find(p => p.day === dIdx && p.hour === h);
                const val = cell ? cell.value : 0;
                const opacity = val === 0 ? 0.03 : 0.1 + (val / maxVal) * 0.9;
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 - ${val} activities`}
                    style={{
                      background: val > 0 ? accent : 'white',
                      height: '14px',
                      borderRadius: '2px',
                      opacity: opacity,
                      transition: 'all 0.3s ease'
                    }}
                  />
                );
              })}
              <div style={{ fontSize: '0.6rem', opacity: 0.4, textAlign: 'center', marginTop: '8px' }}>{day}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    );
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="page-content"
    >
      {/* 1. Hero Summary Row */}
      <div className="hero-grid" style={{ marginBottom: '1.5rem' }}>
        <motion.div variants={item} className="platform-card stat-card main-stat interactive-card" style={{
          borderLeft: `4px solid ${accent}`
        }}>
          <div className="card-shine"></div>
          <span className="stat-label">TOTAL DISTANCE</span>
          <span className="stat-value">{stats.total_distance?.toFixed(1)} <small>KM</small></span>
          <div className="stat-graph-mini">
            <TrendingUp size={16} color={accent} />
            <span> {stats.sport_type?.toUpperCase()} LIFE-TIME </span>
          </div>
        </motion.div>

        <motion.div variants={item} className="platform-card stat-card interactive-card">
          <span className="stat-label">{stats.sport_type === 'Ride' ? 'TOTAL ELEVATION' : 'ACTIVE SESSIONS'}</span>
          <span className="stat-value">
            {stats.sport_type === 'Ride' 
              ? `${Math.round(stats.recent_activities?.reduce((acc, a) => acc + (a.elevation_gain || 0), 0) || 0)}`
              : stats.total_count
            }
            {stats.sport_type === 'Ride' && <small style={{fontSize: '0.8rem', opacity: 0.4, marginLeft: '5px'}}>M</small>}
          </span>
          <div style={{ marginTop: '10px' }}>
            {stats.sport_type === 'All' ? (
              <>
                <span className="badge run" style={{ padding: '2px 8px' }}>{stats.breakdown?.Run?.count || 0} RUNS</span>
                <span className="badge ride" style={{ padding: '2px 8px', marginLeft: '5px' }}>{stats.breakdown?.Ride?.count || 0} RIDES</span>
              </>
            ) : (
              <span className="stat-sub">{stats.sport_type?.toUpperCase()} FOCUS MODE</span>
            )}
          </div>
        </motion.div>

        <motion.div variants={item} className="platform-card stat-card interactive-card">
          <span className="stat-label">FITNESS (CTL)</span>
          <span className="stat-value" style={{ color: stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)' }}>{currentLoad.ctl.toFixed(1)}</span>
          <span className="stat-sub">Steady Progress</span>
        </motion.div>

        <motion.div
          variants={item}
          className="platform-card stat-card interactive-card"
          onClick={() => { setDetailType('training'); setShowDetail(true); }}
          style={{ cursor: 'pointer' }}
        >
          <span className="stat-label">STATUS (TSB)</span>
          <span className="stat-value" style={{
            color: currentLoad.tsb > 0 ? '#10b981' : (currentLoad.tsb < -10 ? '#ef4444' : '#f59e0b')
          }}>
            {currentLoad.tsb.toFixed(1)}
          </span>
          <span className="stat-sub">{currentLoad.tsb > 0 ? 'Fresh / Peak' : 'Fatigued'}</span>
        </motion.div>

        <motion.div variants={item} className={`platform-card stat-card interactive-card ${stats.streaks?.current > 0 ? 'streak-active' : ''}`}>
          <span className="stat-label">CURRENT STREAK</span>
          <span className="stat-value">{stats.streaks?.current || 0}</span>
          <span className="stat-sub">🔥 CONSECUTIVE DAYS</span>
        </motion.div>
      </div>

      {/* 2. Smart Coach Advice (Immediate Context) */}
      {stats.smart_coach && (
        <motion.div
          variants={item}
          className="platform-card"
          style={{
            padding: '1.25rem',
            marginBottom: '2.5rem',
            background: stats.smart_coach.advice.includes('ATTENTION') ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.02)',
            border: stats.smart_coach.advice.includes('ATTENTION') ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {stats.smart_coach.advice.includes('ATTENTION') && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ef4444' }} />
          )}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: stats.smart_coach.advice.includes('ATTENTION') ? 'linear-gradient(135deg, #ef4444, #f59e0b)' : 'linear-gradient(135deg, var(--accent-cyan), #bd00ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: stats.smart_coach.advice.includes('ATTENTION') ? '0 0 20px rgba(239, 68, 68, 0.3)' : '0 0 20px rgba(6, 182, 212, 0.3)'
            }}>
              {stats.smart_coach.advice.includes('ATTENTION') ? <AlertCircle size={20} /> : <Zap size={20} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, letterSpacing: '1px' }}>SMART COACH ADVICE</h4>
                <span className={`badge ${stats.smart_coach.status.toLowerCase()}`} style={{ fontSize: '0.55rem' }}>
                  {stats.smart_coach.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '4px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                {stats.smart_coach.advice.split(' | ')[0]}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>EFFICIENCY</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
                {stats.smart_coach.efficiency}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. Recent Form Comparison Row */}
      {stats.recent_form && (
        <div
          className="platform-grid"
          style={{ marginBottom: '2.5rem', gridTemplateColumns: 'repeat(3, 1fr)', cursor: 'pointer' }}
          onClick={() => { setDetailType('form'); setShowDetail(true); }}
        >
          <motion.div variants={item} className="platform-card interactive-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>WEEKLY DISTANCE</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>
                  {stats.recent_form.this_week.distance} <small style={{ fontSize: '0.8rem', opacity: 0.4 }}>KM</small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: stats.recent_form.this_week.distance >= stats.recent_form.last_week.distance ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: stats.recent_form.this_week.distance >= stats.recent_form.last_week.distance ? '#10b981' : '#ef4444',
                    fontWeight: 700
                  }}>
                    {stats.recent_form.this_week.distance >= stats.recent_form.last_week.distance ? '+' : ''}
                    {(((stats.recent_form.this_week.distance - stats.recent_form.last_week.distance) / (stats.recent_form.last_week.distance || 1)) * 100).toFixed(0)}%
                  </span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>vs last week ({stats.recent_form.last_week.distance}km)</span>
                </div>
              </div>
              <div style={{ width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isRun ? 'rgba(255, 51, 102, 0.1)' : 'rgba(6, 182, 212, 0.1)', borderRadius: '10px', color: 'var(--accent-cyan)' }}>
                <TrendingUp size={18} />
              </div>
            </div>
          </motion.div>

          <motion.div variants={item} className="platform-card interactive-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>TRAINING STRESS (TRIMP)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>
                  {stats.recent_form.this_week.stress}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: '#8b5cf6',
                    fontWeight: 700
                  }}>
                    {stats.recent_form.this_week.stress >= stats.recent_form.last_week.stress ? 'INCREASING' : 'RECOVERING'}
                  </span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>Prev: {stats.recent_form.last_week.stress}</span>
                </div>
              </div>
              <div style={{ width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '10px', color: '#8b5cf6' }}>
                <Zap size={18} />
              </div>
            </div>
          </motion.div>

          <motion.div variants={item} className="platform-card interactive-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>RECENT CONSISTENCY</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>
                  {stats.recent_form.this_week.count} <small style={{ fontSize: '0.8rem', opacity: 0.4 }}>SESSIONS</small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {(stats.recent_form.this_week.consistency || [0, 0, 0, 0, 0, 0, 0]).map((active, i) => (
                      <div key={i} style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '2px',
                        background: active ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)'
                      }}></div>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>sessions / 7 days</span>
                </div>
              </div>
              <div style={{ width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '10px', color: '#ec4899' }}>
                <Calendar size={18} />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 3. Real-time Training Load & Goals (Side-by-side) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
        <motion.div
          variants={item}
          className="platform-card main-chart-card"
          style={{ padding: '2rem', cursor: 'pointer' }}
          onClick={() => { setDetailType('training'); setShowDetail(true); }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={20} color="var(--accent-cyan)" /> TRAINING LOAD (90 DAYS)
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button 
                className="action-btn-sm"
                onClick={(e) => { e.stopPropagation(); setDetailType('training'); setShowDetail(true); }}
                style={{
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.2)',
                  color: 'var(--accent-cyan)',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                DEEP ANALYSIS
              </button>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', opacity: 0.6 }}>
                  <div style={{ width: '10px', height: '2px', background: 'var(--accent-cyan)' }}></div> FITNESS
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', opacity: 0.6 }}>
                  <div style={{ width: '10px', height: '2px', background: '#bd00ff' }}></div> FATIGUE
                </div>
              </div>
            </div>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={stats.training_load}>
                <defs>
                  <linearGradient id="colorCtl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)'} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)'} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAtl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#bd00ff" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#bd00ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.2)"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(str) => str.split('-').slice(1).join('/')}
                />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                  contentStyle={{
                    background: 'rgba(10, 22, 40, 0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    fontSize: '11px'
                  }}
                />
                <Area type="monotone" dataKey="ctl" stroke={stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)'} strokeWidth={3} fillOpacity={1} fill="url(#colorCtl)" name="Fitness" />
                <Area type="monotone" dataKey="atl" stroke="#bd00ff" strokeWidth={1.5} fillOpacity={1} fill="url(#colorAtl)" name="Fatigue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Goals Summary (Moved here for tighter correlation) */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={18} color={stats.sport_type === 'Run' ? '#ff3366' : '#f59e0b'} /> PERFORMANCE GOALS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {stats.goals?.map(goal => (
              <div key={goal.title}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{goal.title.toUpperCase()}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{Math.round((goal.current / goal.target) * 100)}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    style={{ height: '100%', background: stats.sport_type === 'Run' ? 'linear-gradient(90deg, #ff3366, #ff85a1)' : 'linear-gradient(90deg, var(--accent-cyan), #bd00ff)', borderRadius: '2px' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.7rem', opacity: 0.4 }}>
                  <span>{goal.current}</span>
                  <span>GOAL: {goal.target} {goal.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 2.1 Most Recent Activities (New P0 Widget) */}
      <motion.div variants={item} className="platform-card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={22} color="var(--accent-cyan)" /> MOST RECENT ACTIVITIES
          </h3>
          <button
            onClick={() => setActiveTab && setActiveTab('Activities')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--glass-border)',
              padding: '6px 16px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            VIEW ALL <ArrowRight size={14} />
          </button>
        </div>
        <div style={{ overflowX: 'auto', marginTop: '-1rem' }}>
          <table className="activity-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px' }}>DATE</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>NAME / LOCATION</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>TYPE</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>DISTANCE / CLIMB</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>{stats.primary_metric?.toUpperCase()} / TIME</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>HR / CAL</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_activities?.slice(0, 5).map((act, idx) => (
                <tr 
                  key={act.run_id || idx} 
                  onClick={() => {
                    if (setActiveTab) {
                      if (setInitialSearch) setInitialSearch(act.name);
                      setActiveTab('Activities');
                    }
                  }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                >
                  <td style={{ fontSize: '0.75rem', opacity: 0.6, padding: '12px' }}>
                    {new Date(act.start_date_local).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ fontWeight: 700, padding: '12px' }}>
                    <div>{act.name}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.4, fontWeight: 400 }}>{act.location_city || 'TrackRecord Studio'}</div>
                  </td>
                  <td style={{ padding: '12px' }}><span className={`badge ${act.type.toLowerCase()}`}>{act.type.toUpperCase()}</span></td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 800 }}>{(act.distance / 1000).toFixed(2)} KM</div>
                    {act.elevation_gain > 0 && (
                      <div style={{ fontSize: '0.7rem', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={10} /> {Math.round(act.elevation_gain)}m
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600 }}>{act.gap_pace ? act.gap_pace : '-'}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>{act.moving_time_display}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {act.average_heartrate > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                            <Heart size={10} fill="#ef4444" /> {Math.round(act.average_heartrate)}
                          </div>
                        )}
                        {act.average_cadence > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                            <Footprints size={10} /> {Math.round(act.average_cadence < 120 && act.type.toLowerCase().includes('run') ? act.average_cadence * 2 : act.average_cadence)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {act.calories > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                            <Flame size={10} fill="#f59e0b" /> {act.calories}
                          </div>
                        )}
                        {act.average_watts > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                            <Zap size={10} fill="#8b5cf6" /> {Math.round(act.average_watts)}W
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* 4. Athlete Insights (Patterns & Profile) */}
      <h4 style={{ fontSize: '0.7rem', opacity: 0.4, letterSpacing: '2px', marginBottom: '1.25rem' }}>ATHLETE PROFILE & PATTERN ANALYSIS</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* Athlete Profile Radar */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="#ec4899" /> PERFORMANCE RADAR
          </h3>
          <div style={{ height: '230px', margin: '0 -10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={stats.athlete_radar}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                <Radar name="Stats" dataKey="A" stroke="#ec4899" fill="#ec4899" fillOpacity={0.4} />
                <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px', fontSize: '11px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Activity Pattern (Heatmap) */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="var(--accent-cyan)" /> HABIT CONSISTENCY
            </h3>
            <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>HOUR vs WEEKDAY</span>
          </div>
          {renderActivityPattern()}
        </motion.div>

        {/* Sport Distribution Pie */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieIcon size={18} color={stats.sport_type === 'Run' ? '#ff3366' : '#bd00ff'} /> ACTIVITY BREAKDOWN
          </h3>
          <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', height: '140px' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={sportData}
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sportData.map((entry, index) => {
                      const sportColors = stats.sport_type === 'Run' 
                        ? ['#ff3366', '#ff85a1', '#ffb3c1', '#ffd9e0'] 
                        : ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];
                      return <Cell key={`cell-${index}`} fill={sportColors[index % sportColors.length]} />;
                    })}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
              {sportData.slice(0, 4).map((s, idx) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (stats.sport_type === 'Run' ? ['#ff3366', '#ff85a1', '#ffb3c1', '#ffd9e0'][idx % 4] : COLORS[idx % COLORS.length]) }}></div>
                  <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 5. Historical Trends & Records (Growth Area) */}
      <h4 style={{ fontSize: '0.7rem', opacity: 0.4, letterSpacing: '2px', marginBottom: '1.25rem' }}>LONG-TERM GROWTH & RECORDS</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* YOY Trends */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TrendingUp size={18} color="var(--accent-cyan)" /> CUMULATIVE DISTANCE TRENDS (YOY)
            </h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '70%' }}>
              {stats.available_years?.map((yr, i) => (
                <div key={yr} style={{ fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: COLORS[i % COLORS.length] }}></div> {yr}
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: '320px' }}>
            <ResponsiveContainer>
              <LineChart data={stats.yoy_cumulative}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,0.2)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  ticks={[1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]}
                  tickFormatter={(val) => {
                    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
                    const idx = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335].indexOf(val);
                    return idx !== -1 ? months[idx] : "";
                  }}
                />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}k`} />
                <Tooltip
                  contentStyle={{ background: 'rgba(10, 22, 40, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                {stats.available_years?.map((yr, i) => (
                  <Line
                    key={yr}
                    type="monotone"
                    dataKey={`${yr}_dist`}
                    name={yr}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={yr === String(new Date().getFullYear()) ? 3 : 1}
                    dot={false}
                    activeDot={{ r: 4 }}
                    opacity={yr === String(new Date().getFullYear()) ? 1 : 0.3}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* PR Summary Table */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={16} color="#f59e0b" /> PERSONAL RECORDS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stats.dashboard_records?.map((rec, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '10px',
                borderLeft: `3px solid ${stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)'}`
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>{rec.name}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>{rec.date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 900, color: stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)' }}>{rec.best}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>{rec.pace}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 6. System Health & Physiology (Hardware & Bio) */}
      <h4 style={{ fontSize: '0.7rem', opacity: 0.4, letterSpacing: '2px', marginBottom: '1.25rem' }}>SYSTEM MAINTENANCE & BIOLOGICS</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* Gear Monitoring */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={16} color="#10b981" /> GEAR LIFE MONITOR
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {stats.gear_stats?.slice(0, 2).map((gear, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem' }}>
                  <span>{gear.name}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{gear.distance.toFixed(0)} / {gear.limit} km</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (gear.distance / gear.limit) * 100)}%`,
                    background: gear.distance > gear.limit * 0.9 ? '#ef4444' : '#10b981'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* HR Intensity Bands */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart size={16} color="#ef4444" /> INTENSITY (HR ZONES)
          </h3>
          <div style={{ height: '120px' }}>
            <ResponsiveContainer>
              <BarChart data={stats.hr_zones}>
                <XAxis dataKey="zone" hide />
                <Tooltip 
                  contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                  itemStyle={{ color: 'white' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {stats.hr_zones?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#7c3aed'][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.6rem', opacity: 0.4, marginTop: '8px' }}>AEROBIC vs ANAEROBIC MIX</div>
        </motion.div>

        {/* Distance Structure Breakdown */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="#bd00ff" /> DISTANCE STRUCTURE
          </h3>
          <div style={{ height: '120px' }}>
            <ResponsiveContainer>
              <BarChart data={stats.distance_breakdown}>
                <Bar dataKey="count" fill="#bd00ff" radius={[2, 2, 0, 0]} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px', fontSize: '10px' }} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.6rem', opacity: 0.4, marginTop: '8px' }}>SESSION LENGTH DISTRIBUTION</div>
        </motion.div>
      </div>

      {/* 7. Bio & Analytics Footer Group */}
      <h4 style={{ fontSize: '0.7rem', opacity: 0.4, letterSpacing: '2px', marginBottom: '1.25rem' }}>BIOLOGIC FEEDBACK & CADENCE</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* Bio Summary Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <motion.div variants={item} className="platform-card" style={{ padding: '1.25rem', flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', color: '#10b981' }}>
                <Footprints size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: '1px' }}>STEPS</div>
                <div style={{ fontSize: '1rem', fontWeight: 900 }}>{stats.bio_stats?.estimated_steps?.toLocaleString()}</div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={item} className="platform-card" style={{ padding: '1.25rem', flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', color: '#ef4444' }}>
                <Flame size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: '1px' }}>CALORIES</div>
                <div style={{ fontSize: '1rem', fontWeight: 900 }}>{stats.bio_stats?.total_calories?.toLocaleString()} KCAL</div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={item} className="platform-card" style={{ padding: '1.25rem', flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isRun ? 'rgba(255, 51, 102, 0.1)' : 'rgba(6, 182, 212, 0.1)', borderRadius: '10px', color: 'var(--accent-cyan)' }}>
                <Scale size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: '1px' }}>WEIGHT</div>
                <div style={{ fontSize: '1rem', fontWeight: 900 }}>{stats.bio_stats?.weight} KG</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Cadence Distribution */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color={stats.sport_type === 'Run' ? '#ff3366' : '#10b981'} /> {stats.bio_stats?.cadence_type || 'CADENCE PROFILE'}
          </h3>
          <div style={{ flex: 1, minHeight: '200px' }}>
            <ResponsiveContainer>
              <BarChart data={stats.bio_stats?.cadence_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" fontSize={9} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px' }} 
                />
                <Bar dataKey="count" fill={stats.sport_type === 'Run' ? '#ff3366' : '#10b981'} radius={[3, 3, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* 6. Activity Contribution Grid Widget */}
      <motion.div variants={item} className="platform-card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Map size={18} color={stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)'} /> YEARLY ACTIVITY CONTRIBUTION
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Metric Toggle */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
              {['count', 'dist', 'time', 'elev', 'cal'].map(m => (
                <button
                  key={m}
                  onClick={() => setHeatMetric(m)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: heatMetric === m ? (stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)') : 'transparent',
                    color: heatMetric === m ? '#000' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  {m === 'count' ? 'SESSIONS' : m.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.4 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>LESS</span>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[0, 1, 2, 3, 4].map(l => (
                  <div key={l} className={`heatmap-day level-${l}`} style={{ width: '8px', height: '8px' }}></div>
                ))}
              </div>
              <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>MORE</span>
            </div>
          </div>
        </div>
        <div style={{ padding: '0.5rem 0' }}>
          {renderHeatmap(heatMetric)}
        </div>
      </motion.div>

      {/* 7. Redundant Footer Cards Removed */}

      {/* Deep Analysis Detail Panel */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowDetail(false)}
          >
            <motion.div
              initial={{ x: 600 }}
              animate={{ x: 0 }}
              exit={{ x: 600 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="activity-detail-panel"
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header">
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                  {detailType === 'training' ? 'TRAINING LOAD ANALYSIS' : 'RECENT FORM DETAILS'}
                </h2>
                <button className="close-panel-btn" onClick={() => setShowDetail(false)}>
                  <ChevronRight size={24} />
                </button>
              </div>
              <div className="panel-content">
                {detailType === 'training' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {['history', 'forecast'].map(t => (
                        <button
                          key={t}
                          onClick={() => setPanelTab(t)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '10px 0',
                             color: panelTab === t ? accent : 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            borderBottom: panelTab === t ? `2px solid ${accent}` : '2px solid transparent',
                            textTransform: 'uppercase'
                          }}
                        >
                          {t === 'history' ? 'History (Last 90 Days)' : 'Recovery Forecast'}
                        </button>
                      ))}
                    </div>

                    {panelTab === 'history' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
                        {/* Status Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                          <div className="platform-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>CURRENT CTL</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                              {stats.training_details?.ctl || 0} <span style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.5 }}>FITNESS</span>
                            </div>
                          </div>
                          <div className="platform-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>CURRENT ATL</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#bd00ff' }}>
                              {stats.training_details?.atl || 0} <span style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.5 }}>FATIGUE</span>
                            </div>
                          </div>
                          <div className="platform-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>A:C RATIO</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: getACStatus(stats.training_details?.ac_ratio).color }}>
                              {stats.training_details?.ac_ratio || 0}
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.8, color: getACStatus(stats.training_details?.ac_ratio).color }}>
                              {getACStatus(stats.training_details?.ac_ratio).label.toUpperCase()}
                            </div>
                          </div>
                          <div className="platform-card" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TSB (FORM)</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: getTSBStatus(stats.training_details?.tsb).color }}>
                              {stats.training_details?.tsb || 0}
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.8, color: getTSBStatus(stats.training_details?.tsb).color }}>
                              {getTSBStatus(stats.training_details?.tsb).label.toUpperCase()}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Chart */}
                        <div className="platform-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', height: '240px' }}>
                          <h4 style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.6 }}>LOAD HISTORY</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={stats.training_load}>
                              <XAxis dataKey="date" hide />
                              <YAxis hide />
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                              <Tooltip 
                                contentStyle={{ background: '#111', border: '1px solid #333', fontSize: '12px' }}
                                itemStyle={{ padding: '2px 0' }}
                              />
                              <Area type="monotone" dataKey="ctl" stroke="var(--accent-cyan)" fill="rgba(6, 182, 212, 0.1)" strokeWidth={2} name="Fitness" />
                              <Area type="monotone" dataKey="atl" stroke="#bd00ff" fill="rgba(189, 0, 255, 0.05)" strokeWidth={1} name="Fatigue" />
                              <Line type="monotone" dataKey="tsb" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="Form" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Additional Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>MONOTONY</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{stats.training_details?.monotony || 0}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>REST DAYS (7D)</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{stats.training_details?.rest_days_7d || 0}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>WEEKLY STRESS</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{stats.training_details?.weekly_stress || 0}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {panelTab === 'forecast' && (
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem', opacity: 0.7, padding: '1rem', background: 'rgba(6, 182, 212, 0.05)', borderRadius: '12px' }}>
                          <Zap size={14} style={{ marginRight: '6px' }} />
                          Shows how your <b>TSB (Form)</b> and <b>A:C Ratio</b> will recover over time if you take complete rest days.
                        </div>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              <th style={{ textAlign: 'left', padding: '10px 0', opacity: 0.4 }}>DAY</th>
                              <th style={{ textAlign: 'center', padding: '10px 0', opacity: 0.4 }}>TSB</th>
                              <th style={{ textAlign: 'center', padding: '10px 0', opacity: 0.4 }}>A:C RATIO</th>
                              <th style={{ textAlign: 'right', padding: '10px 0', opacity: 0.4 }}>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.training_details?.forecast?.map((day, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '12px 0', fontWeight: 600 }}>
                                  {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </td>
                                <td style={{ textAlign: 'center', color: day.tsb > 0 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                                  {day.tsb > 0 ? `+${day.tsb}` : day.tsb}
                                </td>
                                <td style={{ textAlign: 'center' }}>{day.ac_ratio}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <span style={{ 
                                    fontSize: '0.7rem', 
                                    padding: '2px 8px', 
                                    borderRadius: '4px', 
                                    background: `${getTSBStatus(day.tsb).color}20`, 
                                    color: getTSBStatus(day.tsb).color,
                                    fontWeight: 800
                                  }}>
                                    {getTSBStatus(day.tsb).label.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {detailType === 'form' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="detail-stat-box">
                      <span className="label">DISTANCE DELTA</span>
                      <span className="value">
                        {stats.recent_form.this_week.distance} km vs {stats.recent_form.last_week.distance} km
                      </span>
                    </div>
                    <div className="detail-stat-box">
                      <span className="label">STRESS (TRIMP) DELTA</span>
                      <span className="value">
                        {stats.recent_form.this_week.stress} vs {stats.recent_form.last_week.stress}
                      </span>
                    </div>
                    <div className="platform-card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 style={{ marginBottom: '1rem' }}>WEEKLY CONSISTENCY</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                          <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '8px' }}>{day}</div>
                            <div style={{
                              height: '30px',
                              borderRadius: '8px',
                              background: i < stats.recent_form.this_week.count ? accent : 'rgba(255,255,255,0.05)',
                              boxShadow: i < stats.recent_form.this_week.count ? `0 0 10px ${isRun ? 'rgba(255, 51, 102, 0.3)' : 'rgba(6, 182, 212, 0.3)'}` : 'none'
                            }}></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Dashboard;
