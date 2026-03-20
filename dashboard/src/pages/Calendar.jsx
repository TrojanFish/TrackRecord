import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const SPORT_COLORS = {
  Run: '#ff3366', TrailRun: '#ff6b8a', VirtualRun: '#ff8fab',
  Ride: '#06b6d4', VirtualRide: '#22d3ee', E_BikeRide: '#67e8f9',
  Velomobile: '#a5f3fc',
};

const getSportColor = (type) => SPORT_COLORS[type] || '#8b5cf6';

const Calendar = ({ stats }) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  if (!stats) return null;

  // Build a map of date → list of activities from daily_stats
  const dayMap = {};
  (stats.daily_stats || []).forEach(d => {
    if (!dayMap[d.date]) dayMap[d.date] = [];
    dayMap[d.date].push(d);
  });

  const goBack = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(m => m - 1);
  };
  const goForward = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0=Sun

  const monthName = firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Monthly summary
  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthActivities = (stats.daily_stats || []).filter(d => d.date?.startsWith(monthStr));
  const monthDist = monthActivities.reduce((s, d) => s + (d.dist || 0) / 1000, 0);
  const monthElev = monthActivities.reduce((s, d) => s + (d.elev || 0), 0);
  const monthTime = monthActivities.reduce((s, d) => s + (d.time || 0), 0);
  const monthCount = monthActivities.reduce((s, d) => s + (d.count || 0), 0);

  const cells = [];
  // Empty cells before the 1st
  for (let i = 0; i < startWeekday; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }
  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const acts = dayMap[dateStr] || [];
    const isToday = dateStr === today.toISOString().slice(0, 10);
    const hasActivity = acts.length > 0;

    cells.push(
      <div
        key={day}
        style={{
          aspectRatio: '1',
          borderRadius: '10px',
          border: isToday ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.05)',
          background: hasActivity ? 'rgba(255,255,255,0.03)' : 'transparent',
          padding: '4px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '52px',
        }}
      >
        <div style={{
          fontSize: '0.65rem',
          fontWeight: isToday ? 900 : 600,
          color: isToday ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.4)',
          lineHeight: 1,
          marginBottom: '4px',
        }}>
          {day}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', flex: 1 }}>
          {acts.slice(0, 3).map((act, i) => (
            <div
              key={i}
              title={`${act.type} · ${(act.dist / 1000).toFixed(1)} km`}
              style={{
                width: '100%',
                height: '4px',
                borderRadius: '2px',
                background: getSportColor(act.type),
                opacity: 0.85,
              }}
            />
          ))}
        </div>
        {acts.length > 0 && (
          <div style={{ fontSize: '0.5rem', opacity: 0.5, lineHeight: 1, marginTop: '2px' }}>
            {(acts.reduce((s, a) => s + (a.dist || 0), 0) / 1000).toFixed(1)}km
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content"
    >
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
        {/* Header: navigator + title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={goBack} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={18} />
            </button>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0 }}>{monthName.toUpperCase()}</h2>
            <button onClick={goForward} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }} style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '8px', color: 'var(--accent-cyan)', padding: '4px 12px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}>
              TODAY
            </button>
          </div>
          {/* Monthly summary pills */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: 'ACTIVITIES', value: monthCount },
              { label: 'DISTANCE', value: `${monthDist.toFixed(1)} km` },
              { label: 'ELEVATION', value: `${Math.round(monthElev)} m` },
              { label: 'TIME', value: `${Math.round(monthTime / 3600)}h` },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.5rem', opacity: 0.5, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
          {weekdays.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: 800, opacity: 0.4, padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {cells}
        </div>

        {/* Legend */}
        <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {Object.entries(SPORT_COLORS).slice(0, 6).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.6rem', opacity: 0.6 }}>
              <div style={{ width: '12px', height: '4px', borderRadius: '2px', background: color }} />
              {type}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default Calendar;
