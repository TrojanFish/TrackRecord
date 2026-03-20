import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Star, Globe, Award, Activity } from 'lucide-react';

const TYPE_CONFIG = {
  first:    { color: '#f59e0b', Icon: Star },
  distance: { color: '#10b981', Icon: Award },
  count:    { color: 'var(--accent-cyan)', Icon: Activity },
  country:  { color: '#8b5cf6', Icon: Globe },
};

const Milestones = ({ stats }) => {
  const [filter, setFilter] = useState('all');

  if (!stats) return null;

  const milestones = stats.milestones_timeline || [];
  const types = ['all', ...new Set(milestones.map(m => m.type))];
  const filtered = filter === 'all' ? milestones : milestones.filter(m => m.type === filter);

  const filterLabels = { all: 'ALL', first: 'FIRSTS', distance: 'DISTANCE', count: 'SESSIONS', country: 'COUNTRIES' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content"
    >
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'TOTAL MILESTONES', value: milestones.length, color: '#f59e0b' },
          { label: 'COUNTRIES', value: milestones.filter(m => m.type === 'country').length, color: '#8b5cf6' },
          { label: 'DISTANCE PEAKS', value: milestones.filter(m => m.type === 'distance').length, color: '#10b981' },
          { label: 'SESSION PEAKS', value: milestones.filter(m => m.type === 'count').length, color: 'var(--accent-cyan)' },
        ].map(s => (
          <div key={s.label} className="platform-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: 700, letterSpacing: '0.5px', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '0.75rem',
              border: filter === t ? `1px solid ${TYPE_CONFIG[t]?.color || '#f59e0b'}` : '1px solid transparent',
              background: filter === t ? `${TYPE_CONFIG[t]?.color || '#f59e0b'}22` : 'var(--bg-card)',
              color: 'white', fontWeight: 800, fontSize: '0.7rem', letterSpacing: '1px', cursor: 'pointer'
            }}
          >{filterLabels[t] || t.toUpperCase()}</button>
        ))}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="platform-card" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
          <Flag size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
          <p>No milestones yet. Keep training to unlock achievements!</p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{ position: 'absolute', left: '28px', top: 0, bottom: 0, width: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 0 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map((m, idx) => {
              const cfg = TYPE_CONFIG[m.type] || TYPE_CONFIG.first;
              const { Icon } = cfg;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.03 }}
                  style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}
                >
                  {/* Icon bubble */}
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                    background: `${cfg.color}20`, border: `2px solid ${cfg.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem',
                  }}>
                    {m.icon || <Icon size={18} color={cfg.color} />}
                  </div>

                  {/* Content */}
                  <div className="platform-card" style={{ flex: 1, padding: '1rem 1.25rem', borderLeft: `3px solid ${cfg.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: cfg.color }}>{m.title}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.65, marginTop: '2px' }}>{m.description}</div>
                      </div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.4, whiteSpace: 'nowrap' }}>{m.date}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Milestones;
