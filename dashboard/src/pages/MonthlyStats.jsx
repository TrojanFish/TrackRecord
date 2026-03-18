import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Calendar, Activity, TrendingUp, Clock, ChevronLeft, ChevronRight, Trophy, Zap, Flame 
} from 'lucide-react';

const COLORS = ['var(--accent-cyan)', '#bd00ff', '#3b82f6', '#f59e0b', '#10b981'];

const MonthlyStats = ({ stats, renderHeatmap, sportType }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [heatMetric, setHeatMetric] = useState('count');

  if (!stats) return null;

  const themeColor = sportType === 'Run' ? '#ff3366' : 'var(--accent-cyan)';
  const secondaryColors = ['#ff3366', 'var(--accent-cyan)', '#bd00ff', '#f59e0b', '#10b981'];

  // Process data for the selected month
  const monthData = useMemo(() => {
    if (!stats.daily_stats) return { totalDist: 0, totalTime: 0, totalCount: 0, totalElev: 0, totalCalories: 0, trophyCount: 0, chartData: [], pieData: [] };

    // Group by month to see what's available
    const daily = stats.daily_stats.filter(d => d.date && d.date.startsWith(selectedMonth));
    
    const totalDist = daily.reduce((acc, d) => acc + Number(d.dist || 0), 0);
    const totalTime = daily.reduce((acc, d) => acc + Number(d.time || 0), 0);
    const totalCount = daily.reduce((acc, d) => acc + Number(d.count || 0), 0);
    const totalElev = daily.reduce((acc, d) => acc + Number(d.elev || 0), 0);
    
    // Calorie calculation (consistent with backend logic)
    const weight = stats.bio_stats?.weight || 70;
    const totalCalories = daily.reduce((acc, d) => {
        const d_km = Number(d.dist || 0) / 1000.0;
        if (['Run', 'TrailRun', 'VirtualRun'].includes(d.type)) {
            return acc + (d_km * weight * 1.036);
        } else {
            return acc + (d_km * weight * 0.5);
        }
    }, 0);

    const trophyCount = stats.trophies_by_month?.[selectedMonth] || 0;

    // Group by day for the bar chart
    const daysInMonth = new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).getDate();
    const chartData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = (i + 1).toString().padStart(2, '0');
      const dateStr = `${selectedMonth}-${day}`;
      const dayStats = daily.filter(d => d.date === dateStr);
      return {
        day: i + 1,
        dist: (dayStats.reduce((acc, d) => acc + Number(d.dist || 0), 0) / 1000).toFixed(2),
        count: dayStats.reduce((acc, d) => acc + Number(d.count || 0), 0)
      };
    });

    // Group by type for the pie chart
    const typeBreakdown = daily.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + Number(d.dist || 0);
      return acc;
    }, {});
    const pieData = Object.entries(typeBreakdown).map(([name, value]) => ({ name, value }));

    return { totalDist, totalTime, totalCount, totalElev, totalCalories, trophyCount, chartData, pieData };
  }, [selectedMonth, stats.daily_stats, stats.bio_stats, stats.trophies_by_month]);

  const changeMonth = (offset) => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() + offset);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content"
    >
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Calendar size={20} color={themeColor} /> ANNUAL {sportType.toUpperCase()} HEATMAP
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
                            background: heatMetric === m ? themeColor : 'transparent',
                            color: heatMetric === m ? (sportType === 'Run' ? 'white' : '#000') : 'var(--text-secondary)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {m === 'count' ? 'SESSIONS' : m.toUpperCase()}
                    </button>
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Last 365 Days</div>
          </div>
        </div>
        
        {renderHeatmap(heatMetric)}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '1.5rem', opacity: 0.7 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>LESS</span>
            <div style={{ display: 'flex', gap: '3px' }}>
                {[0, 1, 2, 3, 4].map(l => {
                  const colors = {
                    Run: ['rgba(255, 255, 255, 0.05)', '#4d0f1f', '#801a33', '#b32447', '#ff3366'],
                    Ride: ['rgba(255, 255, 255, 0.05)', '#03353e', '#045967', '#068d9f', 'var(--accent-cyan)'],
                    All: ['rgba(255, 255, 255, 0.05)', '#1e293b', '#334155', '#475569', '#64748b']
                  }[sportType] || ['rgba(255, 255, 255, 0.05)', '#1e293b', '#334155', '#475569', '#64748b'];
                  return (
                    <div key={l} style={{ width: '10px', height: '10px', background: colors[l], borderRadius: '2px' }}></div>
                  )
                })}
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>MORE</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '2rem', alignItems: 'start' }}>
        {/* Left: Monthly Summary & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="platform-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <button onClick={() => changeMonth(-1)} className="icon-btn"><ChevronLeft size={20} /></button>
               <b style={{ fontSize: '1.1rem', letterSpacing: '1px' }}>{selectedMonth}</b>
               <button onClick={() => changeMonth(1)} className="icon-btn"><ChevronRight size={20} /></button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 800, opacity: 0.8 }}>MONTHLY DISTANCE</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: themeColor }}>
                    {(monthData.totalDist / 1000).toFixed(1)} <small style={{ fontSize: '0.8rem' }}>KM</small>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.55rem', opacity: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Activity size={10} /> ACTIVITIES
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{monthData.totalCount}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.55rem', opacity: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Clock size={10} /> TIME
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{(monthData.totalTime / 3600).toFixed(1)}h</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.55rem', opacity: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <TrendingUp size={10} /> ELEV.
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{Math.round(monthData.totalElev)}<small style={{fontSize:'0.6rem'}}>M</small></div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.55rem', opacity: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Flame size={10} /> CALORIES
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{Math.round(monthData.totalCalories).toLocaleString()}</div>
                </div>
            </div>

            <div style={{ marginTop: '1rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trophy size={16} color="#f59e0b" />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.5px' }}>TROPHIES EARNED</span>
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f59e0b' }}>{monthData.trophyCount}</div>
            </div>
          </div>

          <div className="platform-card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.8 }}>SPORT DISTRIBUTION</h4>
            <div style={{ height: '180px' }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={monthData.pieData}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {monthData.pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={secondaryColors[index % secondaryColors.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '1rem', justifyContent: 'center' }}>
                {monthData.pieData.map((entry, index) => (
                    <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: secondaryColors[index % secondaryColors.length] }} />
                        <span>{entry.name}</span>
                    </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right: Daily Activity Chart */}
        <div className="platform-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={18} color={themeColor} /> DAILY DISTANCE BREAKDOWN
            </h3>
          </div>
          {monthData.totalCount === 0 ? (
            <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                <Activity size={48} style={{ marginBottom: '1rem' }} />
                <p>No activity data discovered for this month.</p>
            </div>
          ) : (
            <div style={{ height: '500px', width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={monthData.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px' }} 
                  />
                  <Bar dataKey="dist" fill={themeColor} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p style={{ marginTop: '1.5rem', opacity: 0.7, fontSize: '0.75rem', textAlign: 'center' }}>
            Showing {sportType} activity intensity across {selectedMonth}. Bars represent cumulative distance in kilometers per day.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default MonthlyStats;
