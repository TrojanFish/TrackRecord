import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid, Legend, BarChart, Bar,
  PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import { 
  Zap, Activity, TrendingUp, Trophy, ArrowRight, 
  Calendar, Layers, Map, PieChart as PieIcon, 
  Heart, Target, Zap as PowerIcon, ChevronRight, Speaker, Volume2, AlertCircle, Clock, Wrench,
  Footprints, Flame, Scale
} from 'lucide-react';

const COLORS = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

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

const Dashboard = ({ stats, setActiveTab, renderHeatmap }) => {
  const [showDetail, setShowDetail] = React.useState(false);
  const [detailType, setDetailType] = React.useState(null);
  const [heatMetric, setHeatMetric] = React.useState('count');

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

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="page-content"
    >
      {/* 1. Hero Summary Row */}
      <div className="hero-grid" style={{ marginBottom: '2.5rem' }}>
        <motion.div variants={item} className="platform-card stat-card main-stat">
          <div className="card-shine"></div>
          <span className="stat-label">TOTAL DISTANCE</span>
          <span className="stat-value">{stats.total_distance?.toFixed(1)} <small>KM</small></span>
          <div className="stat-graph-mini">
             <TrendingUp size={16} color="var(--accent-cyan)" />
             <span>HISTORY ALL-TIME</span>
          </div>
        </motion.div>
        
        <motion.div variants={item} className="platform-card stat-card">
          <span className="stat-label">ACTIVE SESSIONS</span>
          <span className="stat-value">{stats.total_count}</span>
          <div style={{ marginTop: '10px' }}>
              <span className="badge run" style={{ padding: '2px 8px' }}>{stats.breakdown?.Run?.count || 0} RUNS</span>
              <span className="badge ride" style={{ padding: '2px 8px', marginLeft: '5px' }}>{stats.breakdown?.Ride?.count || 0} RIDES</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="platform-card stat-card">
          <span className="stat-label">FITNESS (CTL)</span>
          <span className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{currentLoad.ctl.toFixed(1)}</span>
          <span className="stat-sub">Steady Progress</span>
        </motion.div>

        <motion.div 
          variants={item} 
          className="platform-card stat-card"
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

        <motion.div variants={item} className={`platform-card stat-card ${stats.streaks?.current > 0 ? 'streak-active' : ''}`}>
          <span className="stat-label">CURRENT STREAK</span>
          <span className="stat-value">{stats.streaks?.current || 0}</span>
          <span className="stat-sub">🔥 CONSECUTIVE DAYS</span>
        </motion.div>
      </div>
      
      {/* 2. Recent Form Comparison Row */}
      {stats.recent_form && (
        <div 
          className="platform-grid" 
          style={{ marginBottom: '2.5rem', gridTemplateColumns: 'repeat(3, 1fr)', cursor: 'pointer' }}
          onClick={() => { setDetailType('form'); setShowDetail(true); }}
        >
           <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
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
                 <div style={{ padding: '10px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '10px', color: 'var(--accent-cyan)' }}>
                    <TrendingUp size={18} />
                 </div>
              </div>
           </motion.div>

           <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
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
                 <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '10px', color: '#8b5cf6' }}>
                    <Zap size={18} />
                 </div>
              </div>
           </motion.div>

           <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                 <div>
                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>RECENT CONSISTENCY</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>
                       {stats.recent_form.this_week.count} <small style={{ fontSize: '0.8rem', opacity: 0.4 }}>SESSIONS</small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                       <div style={{ display: 'flex', gap: '3px' }}>
                          {(stats.recent_form.this_week.consistency || [0,0,0,0,0,0,0]).map((active, i) => (
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
                 <div style={{ padding: '10px', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '10px', color: '#ec4899' }}>
                    <Calendar size={18} />
                 </div>
              </div>
           </motion.div>
        </div>
      )}

      {/* 2. Main Performance Chart */}
      <motion.div 
        variants={item} 
        className="platform-card main-chart-card" 
        style={{ padding: '2rem', marginBottom: '2.5rem', cursor: 'pointer' }}
        onClick={() => { setDetailType('training'); setShowDetail(true); }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={22} color="var(--accent-cyan)" /> TRAINING PERFORMANCE ANALYTICS
            </h3>
            <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', opacity: 0.6 }}>
                    <div style={{ width: '12px', height: '3px', background: 'var(--accent-cyan)' }}></div> FITNESS
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', opacity: 0.6 }}>
                    <div style={{ width: '12px', height: '3px', background: '#bd00ff' }}></div> FATIGUE
                </div>
            </div>
        </div>
        
        <div style={{ height: '350px', width: '100%' }}>
          <ResponsiveContainer>
            <AreaChart data={stats.training_load}>
              <defs>
                <linearGradient id="colorCtl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAtl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#bd00ff" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#bd00ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="rgba(255,255,255,0.2)" 
                fontSize={10} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(str) => str.split('-').slice(1).join('/')}
              />
              <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                contentStyle={{ 
                    background: 'rgba(10, 22, 40, 0.9)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)'
                }}
              />
              <Area type="monotone" dataKey="ctl" stroke="var(--accent-cyan)" strokeWidth={4} fillOpacity={1} fill="url(#colorCtl)" name="Fitness" />
              <Area type="monotone" dataKey="atl" stroke="#bd00ff" strokeWidth={2} fillOpacity={1} fill="url(#colorAtl)" name="Fatigue" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

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
          <div className="activity-table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="activities-table">
                  <thead>
                      <tr>
                          <th style={{ textAlign: 'left', padding: '12px' }}>DATE</th>
                          <th style={{ textAlign: 'left', padding: '12px' }}>NAME / LOCATION</th>
                          <th style={{ textAlign: 'left', padding: '12px' }}>TYPE</th>
                          <th style={{ textAlign: 'left', padding: '12px' }}>DISTANCE</th>
                          <th style={{ textAlign: 'left', padding: '12px' }}>MOVING TIME</th>
                          <th style={{ textAlign: 'left', padding: '12px' }}>PACE / GAP</th>
                      </tr>
                  </thead>
                  <tbody>
                      {stats.recent_activities?.slice(0, 5).map((act, idx) => (
                          <tr key={act.run_id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ fontSize: '0.75rem', opacity: 0.6, padding: '12px' }}>
                                 {new Date(act.start_date_local).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td style={{ fontWeight: 700, padding: '12px' }}>
                                 <div>{act.name}</div>
                                 <div style={{ fontSize: '0.7rem', opacity: 0.4, fontWeight: 400 }}>{act.location_city || 'TrackRecord Studio'}</div>
                              </td>
                              <td style={{ padding: '12px' }}><span className={`badge ${act.type.toLowerCase()}`}>{act.type.toUpperCase()}</span></td>
                              <td style={{ fontWeight: 800, padding: '12px' }}>{(act.distance / 1000).toFixed(2)} KM</td>
                              <td style={{ padding: '12px' }}>{act.moving_time_display}</td>
                              <td style={{ padding: '12px' }}>
                                 <div style={{ fontWeight: 600 }}>{act.gap_pace ? act.gap_pace : '-'}</div>
                                 {act.average_heartrate > 0 && (
                                   <div style={{ fontSize: '0.7rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                      <Heart size={10} fill="#ef4444" /> {Math.round(act.average_heartrate)} BPM
                                   </div>
                                 )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </motion.div>

      {/* 2.5 Smart Advice System */}
      {stats.smart_coach && (
        <motion.div 
          variants={item} 
          className="platform-card" 
          style={{ 
            padding: '1.5rem', 
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
                 width: '50px', 
                 height: '50px', 
                 borderRadius: '50%', 
                 background: stats.smart_coach.advice.includes('ATTENTION') ? 'linear-gradient(135deg, #ef4444, #f59e0b)' : 'linear-gradient(135deg, var(--accent-cyan), #bd00ff)',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 color: 'white',
                 boxShadow: stats.smart_coach.advice.includes('ATTENTION') ? '0 0 20px rgba(239, 68, 68, 0.3)' : '0 0 20px rgba(6, 182, 212, 0.3)'
              }}>
                 {stats.smart_coach.advice.includes('ATTENTION') ? <AlertCircle size={24} /> : <Zap size={24} />}
              </div>
              <div style={{ flex: 1 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, letterSpacing: '1px' }}>SMART COACH ADVICE</h4>
                    <span className={`badge ${stats.smart_coach.status.toLowerCase()}`} style={{ fontSize: '0.6rem' }}>
                       {stats.smart_coach.status.toUpperCase()}
                    </span>
                    {stats.smart_coach.advice.includes('ATTENTION') && (
                      <span className="badge fatigued" style={{ fontSize: '0.6rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>GEAR ALERT</span>
                    )}
                 </div>
                 <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '4px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {stats.smart_coach.advice.split(' | ')[0]}
                    <button 
                      onClick={() => {
                        const utterance = new SpeechSynthesisUtterance(stats.smart_coach.advice);
                        utterance.rate = 0.9;
                        window.speechSynthesis.speak(utterance);
                      }}
                      style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        border: 'none', 
                        borderRadius: '50%', 
                        width: '32px', 
                        height: '32px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-cyan)'
                      }}
                      title="Listen to advice"
                    >
                      <Volume2 size={16} />
                    </button>
                 </div>
                 {stats.smart_coach.advice.includes(' | ') && (
                   <div style={{ fontSize: '0.85rem', color: '#ef4444', marginTop: '4px', fontWeight: 500 }}>
                     {stats.smart_coach.advice.split(' | ')[1]}
                   </div>
                 )}
              </div>
              <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>TRAINING EFFICIENCY</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
                      {stats.smart_coach.efficiency}
                  </div>
              </div>
           </div>
        </motion.div>
      )}

      {/* 3. Secondary Metrics Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', marginBottom: '2.5rem' }}>
          {/* Weekly Distance Bar Chart */}
          <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} color="var(--accent-cyan)" /> WEEKLY VOLUME (KM)
              </h3>
              <div style={{ height: '240px' }}>
                  <ResponsiveContainer>
                      <BarChart data={stats.weekly_trends}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="week" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} />
                          <Bar dataKey="total_dist" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} barSize={20}>
                             {stats.weekly_trends?.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === stats.weekly_trends.length - 1 ? 'var(--accent-cyan)' : 'rgba(6, 182, 212, 0.3)'} />
                             ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </motion.div>

          {/* Sport Distribution Pie Chart */}
          <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <PieIcon size={18} color="#bd00ff" /> SPORT TYPE DISTRIBUTION
              </h3>
              <div style={{ height: '240px', display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1, height: '100%' }}>
                      <ResponsiveContainer>
                          <PieChart>
                              <Pie
                                data={sportData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                  {sportData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                              </Pie>
                              <Tooltip />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sportData.map((s, idx) => (
                         <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[idx % COLORS.length] }}></div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{s.name}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{s.dist} KM</span>
                         </div>
                      ))}
                  </div>
              </div>
          </motion.div>
      </div>

      {/* 4. Deep Analytics Row: HR Zones & Period Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', marginBottom: '2.5rem' }}>
          {/* Heart Rate Zones */}
          <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Heart size={18} color="#ef4444" /> HEART RATE ZONES
              </h3>
              <div style={{ height: '240px' }}>
                  <ResponsiveContainer>
                      <BarChart data={stats.hr_zones} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis dataKey="zone" type="category" stroke="rgba(255,255,255,0.4)" fontSize={10} width={80} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} />
                          <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </motion.div>

          {/* Period Comparison */}
          <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={18} color="var(--accent-cyan)" /> YEARLY DISTANCE COMPARISON
              </h3>
              <div style={{ height: '240px' }}>
                  <ResponsiveContainer>
                      <ComposedChart data={stats.period_comparison}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} />
                          <Bar dataKey="this_year" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} barSize={12} name="Current" />
                          <Line type="monotone" dataKey="last_year" stroke="rgba(255,255,255,0.2)" strokeDasharray="5 5" dot={false} name="Previous" />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </motion.div>
      </div>

      {/* 5. Goals & Challenges Section */}
      <motion.div variants={item} className="platform-card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={20} color="#f59e0b" /> PERFORMANCE GOALS & CHALLENGES
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
              {stats.goals?.map(goal => (
                  <div key={goal.title} className="goal-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{goal.title}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{Math.round((goal.current / goal.target) * 100)}%</span>
                      </div>
                      <div className="progress-bar-container" style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginBottom: '1rem', overflow: 'hidden' }}>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-cyan), #bd00ff)', borderRadius: '3px' }}
                          />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{goal.current}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>TARGET: {goal.target} {goal.unit}</span>
                      </div>
                  </div>
              ))}
          </div>
      </motion.div>

      {/* 5.5 P1 Widgets: Temporal & Distance Analysis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
          {/* Weekday Preference */}
          <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="var(--accent-cyan)" /> WEEKDAY PREFERENCE
              </h3>
              <div style={{ height: '180px' }}>
                  <ResponsiveContainer>
                      <BarChart data={stats.weekday_preference}>
                          <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" fontSize={9} tickLine={false} axisLine={false} />
                          <Tooltip 
                             contentStyle={{ background: '#0a1628', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                             itemStyle={{ color: 'var(--accent-cyan)' }}
                          />
                          <Bar dataKey="count" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </motion.div>

          {/* Time Preference */}
          <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#bd00ff" /> TIME OF DAY
              </h3>
              <div style={{ height: '180px' }}>
                  <ResponsiveContainer>
                      <AreaChart data={stats.time_preference}>
                          <XAxis dataKey="slot" stroke="rgba(255,255,255,0.2)" fontSize={9} tickLine={false} axisLine={false} />
                          <Tooltip 
                             contentStyle={{ background: '#0a1628', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                          />
                          <Area type="monotone" dataKey="count" stroke="#bd00ff" fill="rgba(189, 0, 255, 0.1)" strokeWidth={2} />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </motion.div>

          {/* Distance Breakdown */}
          <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} color="#f59e0b" /> DISTANCE STRUCTURE
              </h3>
              <div style={{ height: '180px' }}>
                  <ResponsiveContainer>
                      <BarChart data={stats.distance_breakdown} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis dataKey="label" type="category" stroke="rgba(255,255,255,0.4)" fontSize={9} width={60} tickLine={false} axisLine={false} />
                          <Tooltip 
                             contentStyle={{ background: '#0a1628', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                          />
                          <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={12} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </motion.div>
      </div>

      {/* 5.8 P2 Widgets: Gear Health & Power Analytics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', marginBottom: '2.5rem' }}>
          {/* Gear Health Monitor */}
          <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Wrench size={18} color="var(--accent-cyan)" /> GEAR HEALTH MONITOR
                </h3>
                <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>MAINTENANCE PREVIEW</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {stats.gear_stats?.slice(0, 3).map((gear, idx) => {
                      const health = Math.max(0, 100 - (gear.distance / gear.limit) * 100);
                      return (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{gear.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: health < 15 ? '#ef4444' : (health < 40 ? '#f59e0b' : '#10b981') }}>
                                      {health.toFixed(0)}% LIFE
                                  </span>
                              </div>
                              <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${100 - health}%` }}
                                      style={{ 
                                          height: '100%', 
                                          background: health < 15 ? '#ef4444' : (health < 40 ? '#f59e0b' : 'var(--accent-cyan)')
                                      }}
                                  />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                                  <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>Used: {gear.distance.toFixed(1)} km</span>
                                  <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>Limit: {gear.limit} km</span>
                              </div>
                          </div>
                      );
                  })}
                  {(!stats.gear_stats || stats.gear_stats.length === 0) && (
                      <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.4, fontSize: '0.85rem' }}>
                          No gear data found in settings.
                      </div>
                  )}
              </div>
          </motion.div>

          {/* Power Analytics */}
          <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <PowerIcon size={18} color="#f59e0b" /> POWER INTENSITY (CYCLING)
              </h3>
              <div style={{ height: '260px' }}>
                  <ResponsiveContainer>
                      <BarChart data={stats.power_distribution}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="power_zone" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                             contentStyle={{ background: '#0a1628', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {stats.power_distribution?.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 2 ? '#ef4444' : (index === 1 ? '#f59e0b' : 'var(--accent-cyan)')} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </motion.div>
      </div>

      {/* 5.9 P3 Widgets: Bio-Analytics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem', marginBottom: '2.5rem' }}>
          {/* Bio Summary Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', color: '#10b981' }}>
                          <Footprints size={20} />
                      </div>
                      <div>
                          <div style={{ fontSize: '0.65rem', opacity: 0.5, letterSpacing: '1px' }}>{stats.bio_stats?.cadence_type?.includes('RUNNING') ? 'ESTIMATED STEPS' : 'TOTAL REVOLUTIONS'}</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{stats.bio_stats?.estimated_steps?.toLocaleString()}</div>
                      </div>
                  </div>
              </motion.div>
              
              <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', color: '#ef4444' }}>
                          <Flame size={20} />
                      </div>
                      <div>
                          <div style={{ fontSize: '0.65rem', opacity: 0.5, letterSpacing: '1px' }}>TOTAL CALORIES</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{stats.bio_stats?.total_calories?.toLocaleString()} <small style={{ fontSize: '0.7rem', opacity: 0.4 }}>KCAL</small></div>
                      </div>
                  </div>
              </motion.div>

              <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '10px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '10px', color: 'var(--accent-cyan)' }}>
                          <Scale size={20} />
                      </div>
                      <div>
                          <div style={{ fontSize: '0.65rem', opacity: 0.5, letterSpacing: '1px' }}>ATHLETE WEIGHT</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{stats.bio_stats?.weight} <small style={{ fontSize: '0.7rem', opacity: 0.4 }}>KG</small></div>
                      </div>
                  </div>
              </motion.div>
          </div>

          {/* Cadence Distribution */}
          <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={18} color="#10b981" /> {stats.bio_stats?.cadence_type || 'CADENCE PROFILE'}
                  </h3>
                  <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>{stats.bio_stats?.cadence_type?.includes('RUNNING') ? 'STEPS PER MINUTE (SPM)' : 'REVOLUTIONS PER MINUTE (RPM)'}</span>
              </div>
              <div style={{ height: '260px' }}>
                  <ResponsiveContainer>
                      <BarChart data={stats.bio_stats?.cadence_distribution}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                             contentStyle={{ background: '#0a1628', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                             itemStyle={{ color: '#10b981' }}
                          />
                          <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </motion.div>
      </div>

      {/* 6. Activity Contribution Grid Widget */}
      <motion.div variants={item} className="platform-card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <Map size={18} color="var(--accent-cyan)" /> YEARLY ACTIVITY CONTRIBUTION
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
                                background: heatMetric === m ? 'var(--accent-cyan)' : 'transparent',
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

      {/* 7. Footer Stats Row */}
      <div className="platform-grid">
         <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: '#f59e0b' }}>
                    <Trophy size={20} />
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>TOP PERFORMANCE RECOGNITION</h4>
                    <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                        {stats.records?.["5K"] ? `5K: ${stats.records["5K"].moving_time_display}` : 'Keep pushing for new records!'}
                    </span>
                </div>
            </div>
         </motion.div>
         
         <motion.div variants={item} className="platform-card" style={{ padding: '1.5rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
                        <Zap size={20} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem' }}>RECENT MOMENTUM</h4>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{stats.recent_activities?.length} Activities loaded</span>
                    </div>
                 </div>
                 <ArrowRight size={18} opacity={0.3} />
             </div>
         </motion.div>
      </div>

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                       <div className="platform-card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <h4 style={{ marginBottom: '1rem', color: 'var(--accent-cyan)' }}>FITNESS TREND (CTL)</h4>
                          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                            Chronic Training Load (CTL) represents your long-term fitness. It is a 42-day rolling average of your training stress (TRIMP).
                            Currently at <b>{currentLoad.ctl.toFixed(1)}</b>. A steady 5-10% monthly increase is optimal for progression.
                          </p>
                       </div>
                       <div className="platform-card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <h4 style={{ marginBottom: '1rem', color: '#bd00ff' }}>FATIGUE STATUS (ATL)</h4>
                          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                            Acute Training Load (ATL) is your short-term fatigue (7-day average). 
                            Your current fatigue is <b>{currentLoad.atl.toFixed(1)}</b>. High ATL relative to CTL indicates hard training phases.
                          </p>
                       </div>
                       <div className="platform-card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <h4 style={{ marginBottom: '1rem', color: currentLoad.tsb > 0 ? '#10b981' : '#f59e0b' }}>FORM BALANCE (TSB)</h4>
                          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                            Training Stress Balance (TSB) = CTL - ATL. 
                            Your current form is <b>{currentLoad.tsb.toFixed(1)}</b>.
                            <br/><br/>
                            • <b>+5 to +20</b>: Peak Form / Race Ready<br/>
                            • <b>-10 to +5</b>: Optimal Training<br/>
                            • <b>-30 to -10</b>: Overreaching (Fitness Building)<br/>
                            • <b>Below -30</b>: High Injury Risk
                          </p>
                       </div>
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
                             {['M','T','W','T','F','S','S'].map((day, i) => (
                               <div key={i} style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '8px' }}>{day}</div>
                                  <div style={{ 
                                     height: '30px', 
                                     borderRadius: '8px', 
                                     background: i < stats.recent_form.this_week.count ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)',
                                     boxShadow: i < stats.recent_form.this_week.count ? '0 0 10px rgba(6, 182, 212, 0.3)' : 'none'
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
