import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Legend,
  PieChart, Pie, Cell, ComposedChart,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  Zap, Activity, TrendingUp, Trophy, ArrowRight,
  Calendar, Layers, Map, PieChart as PieIcon,
  Heart, Target, Zap as PowerIcon, ChevronRight, Speaker, Volume2, AlertCircle, Clock,
  Footprints, Flame, User, Dna, Mountain, CheckSquare
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
    const hours = Array.from({ length: 24 }, (_, i) => i); // Use full 24h for smoother granularity

    // Find max value for color scaling
    const maxVal = Math.max(...stats.activity_pattern.map(p => p.value), 1);

    return (
      <div className="pattern-container glass-scroll">
        <div className="pattern-grid" style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '8px', marginTop: '10px' }}>
          {/* Vertical axis: Hours */}
          <div style={{ display: 'grid', gridTemplateRows: '20px repeat(24, 7px)', gap: '1px', fontSize: '0.55rem', opacity: 0.3, textAlign: 'right', paddingRight: '10px' }}>
            <div style={{ height: '20px' }}></div>
            {hours.map(h => <div key={h} style={{ height: '7px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>{h % 4 === 0 ? `${h}:00` : ''}</div>)}
          </div>

          {/* Main Grid: Days */}
          <div className="pattern-grid-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {days.map((day, dIdx) => (
              <div key={day} style={{ display: 'grid', gridTemplateRows: '20px repeat(24, 7px)', gap: '1px' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.4, textAlign: 'center', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{day}</div>
                {hours.map((h) => {
                  const cell = stats.activity_pattern.find(p => p.day === dIdx && p.hour === h);
                  const val = cell ? cell.value : 0;
                  const opacity = val === 0 ? 0.03 : 0.15 + (val / maxVal) * 0.85;
                  return (
                    <div
                      key={h}
                      className="pattern-cell"
                      title={`${day} ${h}:00 - ${val} activities`}
                      style={{
                        background: val > 0 ? accent : 'rgba(255,255,255,0.03)',
                        height: '7px',
                        borderRadius: '1px',
                        opacity: opacity,
                        transition: 'all 0.3s ease',
                        border: val > 0 ? `0.5px solid ${accent}44` : 'none'
                      }}
                    />
                  );
                })}
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
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
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
            {stats.sport_type === 'Ride' && <small style={{ fontSize: '0.8rem', opacity: 0.4, marginLeft: '5px' }}>M</small>}
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

        <motion.div variants={item} className="platform-card stat-card interactive-card" title="CTL (Chronic Training Load) — your 42-day rolling average of training stress. Higher = more fitness base.">
          <span className="stat-label">FITNESS (CTL)</span>
          <span className="stat-value" style={{ color: stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)' }}>{currentLoad.ctl.toFixed(1)}</span>
          <span className="stat-sub">42-day training base</span>
        </motion.div>

        <motion.div
          variants={item}
          className="platform-card stat-card interactive-card"
          onClick={() => { setDetailType('training'); setShowDetail(true); }}
          style={{ cursor: 'pointer' }}
          title="TSB (Training Stress Balance) = Fitness − Fatigue. Positive = fresh/ready to race. Negative = building fitness. Click for details."
        >
          <span className="stat-label">FORM (TSB)</span>
          <span className="stat-value" style={{
            color: currentLoad.tsb > 0 ? '#10b981' : (currentLoad.tsb < -10 ? '#ef4444' : '#f59e0b')
          }}>
            {currentLoad.tsb.toFixed(1)}
          </span>
          <span className="stat-sub">{currentLoad.tsb > 5 ? 'Fresh / Race Ready' : currentLoad.tsb > -5 ? 'Neutral' : currentLoad.tsb > -15 ? 'Building' : 'Fatigued'}</span>
        </motion.div>

        <motion.div variants={item} className={`platform-card stat-card interactive-card ${stats.streaks?.current > 0 ? 'streak-active' : ''}`}>
          <span className="stat-label">STREAK</span>
          <span className="stat-value">{stats.streaks?.current || 0}</span>
          <span className="stat-sub">
            🔥 NOW &nbsp;/&nbsp; <span style={{ opacity: 0.5 }}>BEST {stats.streaks?.day || 0}</span> DAYS
          </span>
        </motion.div>
      </div>

      {/* Fun Stats Paragraph */}
      {stats.total_distance > 0 && (() => {
        const earthTrips = (stats.total_distance / 40075).toFixed(3);
        const moonPct = ((stats.total_distance / 384400) * 100).toFixed(4);
        const everestTimes = ((stats.bio_stats?.total_elevation_m || 0) / 8849).toFixed(1);
        const pizzaSlices = Math.round((stats.bio_stats?.total_calories || 0) / 270);
        const totalHours = Math.round((stats.total_distance / 12));
        return (
          <motion.div variants={item} className="platform-card" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.015)', borderLeft: `4px solid ${accent}` }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.5, letterSpacing: '1px', marginBottom: '0.6rem' }}>YOUR LIFETIME JOURNEY IN NUMBERS</div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.9, margin: 0, opacity: 0.85 }}>
              You have covered <kbd style={{ background: `${accent}22`, color: accent, padding: '1px 7px', borderRadius: '5px', fontWeight: 800, fontFamily: 'monospace', fontSize: '0.9rem' }}>{stats.total_distance?.toFixed(0)} km</kbd> across <kbd style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', padding: '1px 7px', borderRadius: '5px', fontWeight: 800, fontFamily: 'monospace', fontSize: '0.9rem' }}>{stats.total_count}</kbd> activities.
              {' '}That's <kbd style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '1px 7px', borderRadius: '5px', fontWeight: 800, fontFamily: 'monospace', fontSize: '0.9rem' }}>{earthTrips}×</kbd> around the Earth
              , <kbd style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '1px 7px', borderRadius: '5px', fontWeight: 800, fontFamily: 'monospace', fontSize: '0.9rem' }}>{moonPct}%</kbd> of the way to the Moon
              {everestTimes > 0 && <>, and you've climbed the equivalent of <kbd style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', padding: '1px 7px', borderRadius: '5px', fontWeight: 800, fontFamily: 'monospace', fontSize: '0.9rem' }}>{everestTimes}× Mt. Everest</kbd></>}.
              {pizzaSlices > 0 && <>{' '}You've burned roughly <kbd style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', padding: '1px 7px', borderRadius: '5px', fontWeight: 800, fontFamily: 'monospace', fontSize: '0.9rem' }}>{pizzaSlices.toLocaleString()}</kbd> pizza slices worth of calories.</>}
            </p>
          </motion.div>
        );
      })()}

      {/* Carbon Saved Widget */}
      {stats.total_distance > 0 && (() => {
        // Average car emission: 0.21 kg CO2 per km; running/cycling = 0
        const co2SavedKg = Math.round(stats.total_distance * 0.21);
        const treesEquiv = Math.round(co2SavedKg / 21.77); // avg tree absorbs ~21.77 kg CO2/year
        const carsOffRoad = (co2SavedKg / 4600).toFixed(2); // avg car emits ~4600 kg CO2/year
        return (
          <motion.div variants={item} className="platform-card" style={{
            padding: '1.25rem 1.75rem', marginBottom: '1.5rem',
            background: 'rgba(16,185,129,0.04)', borderLeft: '4px solid #10b981'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, letterSpacing: '1px' }}>🌱 CARBON FOOTPRINT SAVED</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{co2SavedKg.toLocaleString()}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '2px' }}>kg CO₂ offset vs. car</div>
              </div>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34d399' }}>{treesEquiv.toLocaleString()}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>trees / year equiv.</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#6ee7b7' }}>{carsOffRoad}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>cars off road / year</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '120px', fontSize: '0.7rem', opacity: 0.5, lineHeight: 1.6 }}>
                Based on avg. car emission of 210g CO₂/km across {stats.total_distance?.toFixed(0)} km.
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* 1.5 Goal / Recovery / Race Countdown Row */}
      {(() => {
        const _sportType = stats.sport_type || 'All';
        const annualTarget = _sportType === 'Run'
          ? (stats.athlete_metrics?.run_annual_distance_target || stats.athlete_metrics?.annual_distance_target || 500)
          : _sportType === 'Ride'
          ? (stats.athlete_metrics?.ride_annual_distance_target || stats.athlete_metrics?.annual_distance_target || 2000)
          : (stats.athlete_metrics?.annual_distance_target || 800);
        const weeklyTarget = annualTarget / 52;
        const weekDist = stats.recent_form?.this_week?.distance ?? 0;
        const weekPct = Math.min(100, Math.round((weekDist / weeklyTarget) * 100));

        const recoveryScore = Math.max(0, Math.min(100, Math.round(50 + currentLoad.tsb * 2)));
        const recoveryStatus = recoveryScore > 80
          ? { label: 'Excellent', color: '#10b981' }
          : recoveryScore >= 60
          ? { label: 'Good', color: '#06b6d4' }
          : recoveryScore >= 40
          ? { label: 'Moderate', color: '#f59e0b' }
          : { label: 'Low', color: '#ef4444' };

        const today = new Date();
        const futureMilestone = stats.athlete_metrics?.milestones
          ?.filter(m => m.date && new Date(m.date) > today)
          ?.sort((a, b) => new Date(a.date) - new Date(b.date))?.[0] ?? null;
        const daysUntilRace = futureMilestone
          ? Math.ceil((new Date(futureMilestone.date) - today) / (1000 * 60 * 60 * 24))
          : null;

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Widget A: Weekly Goal Progress */}
            <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, letterSpacing: '1px' }}>WEEKLY GOAL</span>
                <Target size={14} color={accent} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: accent }}>{weekDist} <small style={{ fontSize: '0.7rem', opacity: 0.5 }}>KM</small></div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden', margin: '0.75rem 0' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${weekPct}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  style={{ height: '100%', background: accent, borderRadius: '2px' }}
                />
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{weekDist} km / {weeklyTarget.toFixed(0)} km target &nbsp;·&nbsp; <b style={{ color: accent }}>{weekPct}%</b></div>
            </motion.div>

            {/* Widget B: Recovery Score */}
            <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, letterSpacing: '1px' }}>RECOVERY SCORE</span>
                <Heart size={14} color={recoveryStatus.color} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, color: recoveryStatus.color }}>{recoveryScore}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: recoveryStatus.color }}>{recoveryStatus.label}</span>
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', opacity: 0.4 }}>TSB: {currentLoad.tsb?.toFixed(1)} · Based on training stress balance</div>
            </motion.div>

            {/* Widget C: Next Race Countdown */}
            <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, letterSpacing: '1px' }}>NEXT RACE</span>
                <Calendar size={14} color={accent} />
              </div>
              {futureMilestone ? (
                <>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, color: accent }}>{daysUntilRace}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, marginTop: '4px', opacity: 0.8 }}>DAYS AWAY</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.6, wordBreak: 'break-word' }}>{futureMilestone.name || futureMilestone.event || 'Race'}</div>
                </>
              ) : (
                <div style={{ opacity: 0.3, marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Set a race goal</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>Add a milestone in settings.yaml</div>
                </div>
              )}
            </motion.div>
          </div>
        );
      })()}

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
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>WEEKLY DISTANCE</span>
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
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>TRAINING STRESS (TRIMP)</span>
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
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>RECENT CONSISTENCY</span>
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

      {/* Training Intelligence Row: A:C Ratio + Polarised Training + Recovery */}
      {stats.training_details && (() => {
        const acRatio = stats.training_details.ac_ratio || 0;
        const acStatus = acRatio < 0.8 ? { label: 'Undertrained', color: '#f59e0b' }
          : acRatio <= 1.3 ? { label: 'Optimal', color: '#10b981' }
          : acRatio <= 1.5 ? { label: 'High Load', color: '#f87171' }
          : { label: 'Danger Zone', color: '#ef4444' };

        const hrz = stats.hr_zones || [];
        const totalHrz = hrz.reduce((s, z) => s + z.count, 0) || 1;
        const z1z2 = Math.round(((hrz[0]?.count || 0) + (hrz[1]?.count || 0)) / totalHrz * 100);
        const z3   = Math.round((hrz[2]?.count || 0) / totalHrz * 100);
        const z4z5 = Math.round(((hrz[3]?.count || 0) + (hrz[4]?.count || 0)) / totalHrz * 100);

        const forecast = stats.training_details.forecast || [];
        const firstPositive = forecast.find(d => d.tsb > 0);
        const daysToFresh = firstPositive
          ? Math.ceil((new Date(firstPositive.date) - new Date()) / 86400000)
          : null;

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* A:C Ratio */}
            <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, letterSpacing: '1px' }}>A:C RATIO</span>
                <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: `${acStatus.color}20`, color: acStatus.color }}>{acStatus.label}</span>
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, color: acStatus.color }}>{acRatio.toFixed(2)}</div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.65rem', opacity: 0.5 }}>ATL ÷ CTL · &lt;0.8 under / 0.8–1.3 optimal / &gt;1.5 danger</div>
              <div style={{ marginTop: '0.5rem', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, acRatio / 2 * 100)}%`, background: acStatus.color, borderRadius: '2px', transition: 'width 0.8s' }} />
              </div>
            </motion.div>

            {/* Polarised Training */}
            <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, letterSpacing: '1px' }}>TRAINING POLARISATION</span>
              </div>
              {[
                { label: 'Easy (Z1-2)', pct: z1z2, color: '#10b981', target: '75-90%' },
                { label: 'Moderate (Z3)', pct: z3, color: '#f59e0b', target: '0-10%' },
                { label: 'Hard (Z4-5)', pct: z4z5, color: '#ef4444', target: '10-20%' },
              ].map(({ label, pct, color, target }) => (
                <div key={label} style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', opacity: 0.7, marginBottom: '2px' }}>
                    <span>{label}</span>
                    <span style={{ color }}>{pct}% <span style={{ opacity: 0.4 }}>({target})</span></span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.8s' }} />
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Recovery Forecast */}
            <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, letterSpacing: '1px', marginBottom: '0.75rem' }}>RECOVERY FORECAST</div>
              {daysToFresh !== null ? (
                <>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, color: '#10b981' }}>{daysToFresh}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>DAYS TO POSITIVE FORM</div>
                </>
              ) : (
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981', marginTop: '0.5rem' }}>Already Fresh!</div>
              )}
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(stats.training_details.forecast || []).slice(0, 3).map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                    <span style={{ opacity: 0.5 }}>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span style={{ color: d.tsb > 0 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{d.tsb > 0 ? '+' : ''}{d.tsb}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* Race Readiness Score */}
      {stats.race_readiness && stats.race_readiness.score > 0 && (() => {
        const rr = stats.race_readiness;
        return (
          <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Score dial */}
                <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
                  <svg viewBox="0 0 72 72" style={{ width: '72px', height: '72px', transform: 'rotate(-90deg)' }}>
                    <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle cx="36" cy="36" r="28" fill="none" stroke={rr.color} strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - rr.score / 100)}`}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 900, color: rr.color, lineHeight: 1 }}>{rr.score}</span>
                    <span style={{ fontSize: '0.45rem', opacity: 0.5, fontWeight: 700 }}>/ 100</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.5, letterSpacing: '1px' }}>RACE READINESS</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: rr.color, lineHeight: 1.2 }}>{rr.label}</div>
                </div>
              </div>
              {/* Component breakdown */}
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {(rr.components || []).map(c => (
                  <div key={c.name} style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ fontSize: '0.55rem', opacity: 0.5, marginBottom: '2px', fontWeight: 700 }}>{c.name.toUpperCase()}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: c.score >= 70 ? '#10b981' : c.score >= 45 ? '#f59e0b' : '#ef4444' }}>{c.score}</div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>{c.value}</div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{ height: '100%', width: `${c.score}%`, background: c.score >= 70 ? '#10b981' : c.score >= 45 ? '#f59e0b' : '#ef4444', transition: 'width 0.8s' }} />
                    </div>
                    <div style={{ fontSize: '0.5rem', opacity: 0.3, marginTop: '2px' }}>{c.weight}% weight</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* 3. Real-time Training Load & Goals (Side-by-side) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
        <motion.div
          variants={item}
          className="platform-card main-chart-card"
          style={{ padding: '2rem', cursor: 'pointer' }}
          onClick={() => { setDetailType('training'); setShowDetail(true); }}
        >
          <div className="card-header">
            <h3 className="card-title" style={{ fontSize: '0.95rem' }}>
              <Activity size={20} color="var(--accent-cyan)" style={{ flexShrink: 0 }} /> TRAINING LOAD (90 DAYS)
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
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
              </motion.button>
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
          <h3 className="card-title" style={{ fontSize: '0.95rem', marginBottom: '2rem' }}>
            <Target size={18} color={stats.sport_type === 'Run' ? '#ff3366' : '#f59e0b'} style={{ flexShrink: 0 }} /> PERFORMANCE GOALS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {stats.goals?.map(goal => (
              <div key={goal.title}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{goal.title.toUpperCase()}</span>
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

      {/* 4-Week Training Block */}
      {stats.weekly_blocks && stats.weekly_blocks.length > 0 && (() => {
        const blocks = stats.weekly_blocks;
        const maxDist = Math.max(...blocks.map(b => b.distance), 1);
        return (
          <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                <CheckSquare size={18} color={accent} style={{ flexShrink: 0 }} /> 4-WEEK TRAINING BLOCK
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
              {blocks.map((b, i) => {
                const pct = (b.distance / maxDist) * 100;
                const isCurrentWeek = b.label === 'This Week';
                return (
                  <div key={b.label} style={{
                    padding: '1rem 0.75rem',
                    background: isCurrentWeek ? `${accent}15` : 'rgba(255,255,255,0.02)',
                    borderRadius: '12px',
                    border: isCurrentWeek ? `1px solid ${accent}44` : '1px solid rgba(255,255,255,0.04)',
                    textAlign: 'center',
                    position: 'relative'
                  }}>
                    <div style={{ fontSize: '0.55rem', fontWeight: 800, opacity: isCurrentWeek ? 1 : 0.5, color: isCurrentWeek ? accent : 'white', marginBottom: '6px', letterSpacing: '0.5px' }}>
                      {b.label}
                    </div>
                    {/* Volume bar */}
                    <div style={{ height: '50px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '6px' }}>
                      <div style={{ width: '24px', background: isCurrentWeek ? accent : `${accent}55`, borderRadius: '3px 3px 0 0', height: `${Math.max(4, pct * 0.5)}px`, transition: 'height 0.8s ease' }} />
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: isCurrentWeek ? accent : 'white', lineHeight: 1 }}>{b.distance}</div>
                    <div style={{ fontSize: '0.55rem', opacity: 0.4, marginBottom: '6px' }}>km</div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{b.count} sessions</div>
                    {b.elevation > 0 && <div style={{ fontSize: '0.55rem', opacity: 0.35, marginTop: '2px' }}>↑{b.elevation}m</div>}
                    {b.trimp > 0 && <div style={{ fontSize: '0.55rem', opacity: 0.35 }}>TRIMP {b.trimp}</div>}
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })()}

      {/* Combined: Recent Activities + Smart Coach sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: stats.smart_coach ? 'minmax(0, 2fr) minmax(0, 1fr)' : '1fr', gap: '2rem', marginBottom: '2.5rem', alignItems: 'start' }}>
        {/* LEFT (2fr): Most Recent Activities */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ fontSize: '0.95rem' }}>
              <Activity size={22} color="var(--accent-cyan)" style={{ flexShrink: 0 }} /> MOST RECENT ACTIVITIES
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
              More
            </button>
          </div>
          <div className="table-scroll-container" style={{ marginTop: '-1rem' }}>
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
                      <div style={{ fontSize: '0.7rem', opacity: 0.4, fontWeight: 400 }}>{act.location_city || act.location_country || '—'}</div>
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

        {/* RIGHT (1fr): Smart Coach + Streaks stacked — only if smart_coach exists */}
        {stats.smart_coach && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Smart Coach card */}
            <motion.div
              variants={item}
              className={`platform-card ${stats.smart_coach.advice.includes('ATTENTION') ? 'coach-alert-pulse' : ''}`}
              style={{
                padding: '1.25rem',
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
                    <h4 style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8, letterSpacing: '1px' }}>SMART COACH ADVICE</h4>
                    <span className={`badge ${stats.smart_coach.status.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                      {stats.smart_coach.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '4px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {stats.smart_coach.advice.split(' | ')[0]}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>EFFICIENCY</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
                    {stats.smart_coach.efficiency}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Streak card — 4 metrics */}
            <motion.div variants={item} className="platform-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1px', opacity: 0.5, marginBottom: '1rem' }}>ACTIVITY STREAKS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                {[
                  { label: 'NOW', value: stats.streaks?.current || 0, unit: 'DAYS', color: accent },
                  { label: 'BEST DAY', value: stats.streaks?.day || 0, unit: 'DAYS', color: null },
                  { label: 'BEST WEEK', value: stats.streaks?.week || 0, unit: 'WKS', color: null },
                  { label: 'BEST MONTH', value: stats.streaks?.month || 0, unit: 'MOS', color: null },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} style={{ padding: '6px 2px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.55rem', opacity: 0.5, marginBottom: '2px', fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: color || 'white', lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: '0.55rem', opacity: 0.35, marginTop: '1px' }}>{unit}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* 4. Athlete Insights (Patterns & Profile) */}
      <h4 style={{ fontSize: '0.7rem', opacity: 0.4, letterSpacing: '2px', marginBottom: '1.25rem' }}>ATHLETE PROFILE & PATTERN ANALYSIS</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* Athlete Profile Radar */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
          <h3 className="card-title" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            <User size={18} color="#ec4899" style={{ flexShrink: 0 }} /> PERFORMANCE RADAR
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
            <h3 className="card-title" style={{ fontSize: '0.9rem' }}>
              <Zap size={16} color="var(--accent-cyan)" style={{ flexShrink: 0 }} /> HABIT CONSISTENCY
            </h3>
            <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>HOUR vs WEEKDAY</span>
          </div>
          {renderActivityPattern()}
        </motion.div>

        {/* Sport Distribution Pie */}
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
          <h3 className="card-title" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            <PieIcon size={18} color={stats.sport_type === 'Run' ? '#ff3366' : '#bd00ff'} style={{ flexShrink: 0 }} /> ACTIVITY BREAKDOWN
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


      {/* Training DNA Card */}
      {stats.training_dna && (
        <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
              <Dna size={18} color="#ec4899" style={{ flexShrink: 0 }} /> TRAINING DNA
            </h3>
            <span style={{ fontSize: '0.7rem', fontWeight: 900, padding: '3px 12px', borderRadius: '999px', background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}>
              {stats.training_dna.style}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'SPORT', value: stats.training_dna.dominant_sport, color: accent },
              { label: 'FAVE DAY', value: stats.training_dna.fav_day?.slice(0, 3).toUpperCase(), color: '#f59e0b' },
              { label: 'TIME SLOT', value: stats.training_dna.time_label, color: '#8b5cf6', small: true },
              { label: 'AVG DISTANCE', value: `${stats.training_dna.avg_distance} km`, color: '#10b981' },
              { label: 'YEARS ACTIVE', value: stats.training_dna.years_active, color: '#06b6d4' },
              { label: 'CONSISTENCY', value: stats.training_dna.consistency_grade, color: stats.training_dna.consistency_grade === 'A' ? '#10b981' : stats.training_dna.consistency_grade === 'B' ? '#06b6d4' : stats.training_dna.consistency_grade === 'C' ? '#f59e0b' : '#ef4444' },
            ].map(d => (
              <div key={d.label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.5rem', opacity: 0.5, fontWeight: 800, letterSpacing: '0.5px', marginBottom: '4px' }}>{d.label}</div>
                <div style={{ fontSize: d.small ? '0.8rem' : '1.1rem', fontWeight: 900, color: d.color, lineHeight: 1.2 }}>{d.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.65rem', opacity: 0.35, textAlign: 'center' }}>
            {stats.training_dna.total_activities} total activities · {stats.training_dna.consistency_pct}% weekly consistency
          </div>
        </motion.div>
      )}

      {/* 6. Activity Contribution Grid Widget */}
      <motion.div variants={item} className="platform-card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div className="card-header">
          <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
            <Map size={18} color={stats.sport_type === 'Run' ? '#ff3366' : 'var(--accent-cyan)'} style={{ flexShrink: 0 }} /> YEARLY ACTIVITY CONTRIBUTION
          </h3>
          <div className="heatmap-controls" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Metric Toggle */}
            <div className="metric-toggle" style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
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
          </div>
        </div>
        <div style={{ padding: '0.5rem 0' }}>
          {renderHeatmap(heatMetric)}
        </div>
        {/* Legend - Desktop: Bottom Right, Mobile: Part of Header (already handled by CSS) */}
        <div className="heatmap-legend-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <div className="heatmap-legend" style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.4 }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>LESS</span>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[0, 1, 2, 3, 4].map(l => (
                <div key={l} className={`heatmap-day level-${l}`} style={{ width: '8px', height: '8px' }}></div>
              ))}
            </div>
            <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>MORE</span>
          </div>
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
