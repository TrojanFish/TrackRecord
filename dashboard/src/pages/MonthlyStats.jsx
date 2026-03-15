import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Calendar, Activity, TrendingUp, Clock, ChevronLeft, ChevronRight 
} from 'lucide-react';

const COLORS = ['var(--accent-cyan)', '#bd00ff', '#3b82f6', '#f59e0b', '#10b981'];

const MonthlyStats = ({ stats, renderHeatmap }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  if (!stats) return null;

  // Process data for the selected month
  const monthData = useMemo(() => {
    const daily = stats.daily_stats.filter(d => d.date.startsWith(selectedMonth));
    const totalDist = daily.reduce((acc, d) => acc + d.dist, 0);
    const totalTime = daily.reduce((acc, d) => acc + d.time, 0);
    const totalCount = daily.reduce((acc, d) => acc + d.count, 0);

    // Group by day for the bar chart
    const daysInMonth = new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).getDate();
    const chartData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = (i + 1).toString().padStart(2, '0');
      const dateStr = `${selectedMonth}-${day}`;
      const dayStats = daily.filter(d => d.date === dateStr);
      return {
        day: i + 1,
        dist: (dayStats.reduce((acc, d) => acc + d.dist, 0) / 1000).toFixed(2),
        count: dayStats.reduce((acc, d) => acc + d.count, 0)
      };
    });

    // Group by type for the pie chart
    const typeBreakdown = daily.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + d.dist;
      return acc;
    }, {});
    const pieData = Object.entries(typeBreakdown).map(([name, value]) => ({ name, value }));

    return { totalDist, totalTime, totalCount, chartData, pieData };
  }, [selectedMonth, stats.daily_stats]);

  const changeMonth = (offset) => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() + offset);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-content"
    >
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={20} color="var(--accent-cyan)" /> ANNUAL ACTIVITY HEATMAP
          </h3>
          <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Last 365 Days</div>
        </div>
        <div className="heatmap-container" style={{ gridTemplateColumns: 'repeat(53, 1fr)' }}>
            {renderHeatmap()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '2rem' }}>
        {/* Left: Monthly Summary & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="platform-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <button onClick={() => changeMonth(-1)} className="icon-btn"><ChevronLeft size={20} /></button>
               <b style={{ fontSize: '1.1rem', letterSpacing: '1px' }}>{selectedMonth}</b>
               <button onClick={() => changeMonth(1)} className="icon-btn"><ChevronRight size={20} /></button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 800 }}>MONTHLY DISTANCE</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
                    {(monthData.totalDist / 1000).toFixed(1)} <small style={{ fontSize: '0.8rem' }}>KM</small>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>ACTIVITIES</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{monthData.totalCount}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>ACTIVE TIME</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{(monthData.totalTime / 3600).toFixed(1)}h</div>
                </div>
            </div>
          </div>

          <div className="platform-card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.6 }}>SPORT DISTRIBUTION</h4>
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
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '1rem', justifyContent: 'center' }}>
                {monthData.pieData.map((entry, index) => (
                    <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[index % COLORS.length] }} />
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
              <Activity size={18} color="var(--accent-cyan)" /> DAILY DISTANCE BREAKDOWN
            </h3>
          </div>
          <div style={{ height: '400px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={monthData.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px' }} 
                />
                <Bar dataKey="dist" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ marginTop: '1.5rem', opacity: 0.4, fontSize: '0.75rem', textAlign: 'center' }}>
            Showing activity intensity across {selectedMonth}. Bars represent cumulative distance in kilometers per day.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default MonthlyStats;
