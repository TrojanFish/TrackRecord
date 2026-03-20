import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, MapPin, Activity, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from 'recharts';

// Country flag emoji from ISO code (approximate — uses unicode flag)
const countryFlag = (country) => {
  // A lookup for common countries to emoji flags
  const flags = {
    China: '🇨🇳', 'United States': '🇺🇸', USA: '🇺🇸', Japan: '🇯🇵',
    Germany: '🇩🇪', France: '🇫🇷', UK: '🇬🇧', 'United Kingdom': '🇬🇧',
    Australia: '🇦🇺', Canada: '🇨🇦', Italy: '🇮🇹', Spain: '🇪🇸',
    Thailand: '🇹🇭', Singapore: '🇸🇬', Malaysia: '🇲🇾', Indonesia: '🇮🇩',
    Korea: '🇰🇷', 'South Korea': '🇰🇷', India: '🇮🇳', Brazil: '🇧🇷',
    Netherlands: '🇳🇱', Sweden: '🇸🇪', Norway: '🇳🇴', Denmark: '🇩🇰',
    Switzerland: '🇨🇭', Portugal: '🇵🇹', Greece: '🇬🇷', Turkey: '🇹🇷',
    Mexico: '🇲🇽', Argentina: '🇦🇷', Vietnam: '🇻🇳', Philippines: '🇵🇭',
    Taiwan: '🇹🇼', HongKong: '🇭🇰', 'Hong Kong': '🇭🇰', Macau: '🇲🇴',
    NewZealand: '🇳🇿', 'New Zealand': '🇳🇿', SouthAfrica: '🇿🇦', 'South Africa': '🇿🇦',
  };
  return flags[country] || '🌐';
};

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#f97316', '#6366f1'];

const WorldMap = ({ stats }) => {
  const [sortBy, setSortBy] = useState('count'); // 'count' | 'distance'

  if (!stats) return null;

  const data = (stats.activity_world || []).sort((a, b) => b[sortBy] - a[sortBy]);
  const totalCountries = data.length;
  const totalActivities = data.reduce((s, d) => s + d.count, 0);
  const totalDistance = data.reduce((s, d) => s + d.distance, 0).toFixed(0);
  const topCountry = data[0] || null;

  const chartData = data.slice(0, 12);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content"
    >
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'COUNTRIES VISITED', value: totalCountries, color: '#06b6d4', icon: <Globe size={18} /> },
          { label: 'ACTIVITIES ABROAD', value: totalActivities, color: '#8b5cf6', icon: <Activity size={18} /> },
          { label: 'TOTAL DISTANCE', value: `${Number(totalDistance).toLocaleString()} km`, color: '#10b981', icon: <TrendingUp size={18} /> },
          { label: 'TOP COUNTRY', value: topCountry ? topCountry.country : '—', color: '#f59e0b', icon: <MapPin size={18} /> },
        ].map(s => (
          <div key={s.label} className="platform-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', opacity: 0.6 }}>
              <span style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.5px' }}>{s.label}</span>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: typeof s.value === 'string' && s.value.length > 8 ? '1rem' : '1.6rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sort controls + Chart */}
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Globe size={20} color="#06b6d4" /> TOP COUNTRIES
          </h3>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {[['count', 'ACTIVITIES'], ['distance', 'DISTANCE']].map(([key, label]) => (
              <button key={key} onClick={() => setSortBy(key)} style={{
                padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
                background: sortBy === key ? '#06b6d4' : 'transparent',
                color: sortBy === key ? '#000' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}>{label}</button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.4 }}>
            <Globe size={48} style={{ marginBottom: '1rem' }} />
            <p>No location data available. Activities with country tags will appear here.</p>
          </div>
        ) : (
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="country" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${countryFlag(v)} ${v.length > 12 ? v.slice(0, 10) + '…' : v}`}
                  width={85}
                />
                <Tooltip
                  contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                  formatter={(v, name) => [sortBy === 'count' ? `${v} activities` : `${v} km`, 'Total']}
                />
                <Bar dataKey={sortBy} radius={[0, 4, 4, 0]} barSize={18}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Country detail table */}
      {data.length > 0 && (
        <div className="platform-card" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MapPin size={20} color="#8b5cf6" /> FULL COUNTRY BREAKDOWN
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="activities-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>COUNTRY</th>
                  <th>ACTIVITIES</th>
                  <th>DISTANCE (KM)</th>
                  <th>AVG / ACTIVITY</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={row.country}>
                    <td style={{ opacity: 0.4, fontWeight: 700 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: PALETTE[idx % PALETTE.length] }}>
                      {countryFlag(row.country)} {row.country}
                    </td>
                    <td>{row.count}</td>
                    <td>{row.distance}</td>
                    <td style={{ opacity: 0.6 }}>{(row.distance / row.count).toFixed(1)} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default WorldMap;
