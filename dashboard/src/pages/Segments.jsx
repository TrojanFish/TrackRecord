import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Milestone as RouteIcon, 
  Search, 
  MapPin, 
  ChevronDown, 
  Calendar, 
  Trophy, 
  Activity, 
  Zap, 
  BarChart2, 
  History,
  X,
  Maximize2,
  TrendingUp,
  Filter
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ScatterChart, Scatter,
  ZAxis
} from 'recharts';

const API_BASE = 'http://localhost:8000';

const Segments = () => {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentEfforts, setSegmentEfforts] = useState([]);
  const [modalMode, setModalMode] = useState('history'); // 'history' | 'charts'
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/segments`);
      setSegments(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch segments", err);
      setLoading(false);
    }
  };

  const fetchSegmentEfforts = async (segmentId) => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/segment_efforts/${segmentId}`);
      setSegmentEfforts(res.data);
    } catch (err) {
      console.error("Failed to fetch segment efforts", err);
    }
  };

  const handleSegmentClick = (segment) => {
    setSelectedSegment(segment);
    fetchSegmentEfforts(segment.id);
    setIsModalOpen(true);
  };

  const filteredSegments = segments.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.city && s.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const formatDuration = (val) => {
    if (!val) return '--';
    if (typeof val === 'number') {
        const h = Math.floor(val / 3600);
        const m = Math.floor((val % 3600) / 60);
        const s = val % 60;
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
    }
    // Handle string "0:01:42"
    return val.split('.')[0];
  };

  const getSpeed = (distKm, timeStr) => {
      if (!timeStr) return '--';
      try {
          const parts = timeStr.split(':');
          const seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
          if (seconds === 0) return '--';
          return (distKm / (seconds / 3600)).toFixed(1);
      } catch { return '--'; }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="page-content" style={{ paddingBottom: '5rem' }}>
      
      {/* Top Search & Filter Bar */}
      <div className="platform-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
          <input 
            type="text" 
            placeholder="Search segments by name or location..." 
            className="search-input-fancy"
            style={{ width: '100%', paddingLeft: '45px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label><RouteIcon size={14} /> ACTIVITY TYPE</label>
          <select className="platform-card" style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '8px', fontSize: '0.85rem' }}>
            <option>All Sports</option>
            <option>Running</option>
            <option>Cycling</option>
          </select>
        </div>

        <div className="filter-group">
          <label><MapPin size={14} /> COUNTRY</label>
          <select className="platform-card" style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '8px', fontSize: '0.85rem' }}>
            <option>All Locations</option>
            <option>China</option>
          </select>
        </div>

        <div className="filter-group">
          <label><Filter size={14} /> OTHER</label>
          <select className="platform-card" style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '8px', fontSize: '0.85rem' }}>
            <option>All Segments</option>
            <option>Starred Only</option>
            <option>KOM/QOM Only</option>
          </select>
        </div>
      </div>

      <div style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.4, marginBottom: '1rem', letterSpacing: '1px' }}>
        {filteredSegments.length} SEGMENTS FOUND
      </div>

      {/* Segments Table */}
      <div className="platform-card" style={{ padding: '0', overflowX: 'auto' }}>
        <table className="activities-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: '2rem' }}>SEGMENT NAME</th>
              <th>PB DATE</th>
              <th>BEST TIME</th>
              <th>AVG SPEED</th>
              <th>DIST</th>
              <th>GRADE</th>
              <th style={{ paddingRight: '2rem', textAlign: 'right' }}>EFFORTS #</th>
            </tr>
          </thead>
          <tbody>
            {filteredSegments.map((segment) => (
              <motion.tr 
                key={segment.id} 
                variants={item}
                onClick={() => handleSegmentClick(segment)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ paddingLeft: '2rem' }}>
                  <div style={{ color: 'white', fontWeight: 700 }}>{segment.name}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '2px' }}>{segment.city || 'Unknown Location'}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8 }}>
                    <Calendar size={12} /> {segment.best_date || '--'}
                  </div>
                </td>
                <td>
                  <div style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>
                    {formatDuration(segment.best_time)}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{getSpeed(segment.distance, segment.best_time)} <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>km/h</span></div>
                </td>
                <td>{(segment.distance || 0).toFixed(2)} km</td>
                <td>{segment.average_grade || 0}%</td>
                <td style={{ paddingRight: '2rem', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                    <TrendingUp size={12} opacity={0.6} /> {segment.effort_count}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isModalOpen && selectedSegment && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(10px)' }}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="platform-card"
              style={{ 
                width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'hidden', 
                padding: 0, display: 'flex', flexDirection: 'column', zIndex: 1
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ padding: '8px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
                        <RouteIcon size={24} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{selectedSegment.name}</h2>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', opacity: 0.6, fontSize: '0.85rem', marginLeft: '3.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><RouteIcon size={14} /> {selectedSegment.distance}km</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={14} /> {selectedSegment.average_grade}% avg grade</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> {selectedSegment.city}</span>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="icon-btn-circle">
                    <X size={20} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div style={{ display: 'flex', padding: '0 2rem', background: 'rgba(255,255,255,0.02)' }}>
                {['history', 'charts'].map(mode => (
                  <button 
                    key={mode}
                    onClick={() => setModalMode(mode)}
                    style={{ 
                      padding: '1.2rem 1.5rem', background: 'none', border: 'none', color: mode === modalMode ? 'var(--accent-cyan)' : 'white',
                      fontWeight: 800, fontSize: '0.75rem', letterSpacing: '1px', opacity: mode === modalMode ? 1 : 0.4, cursor: 'pointer',
                      position: 'relative', transition: 'all 0.3s'
                    }}
                  >
                    {mode.toUpperCase()}
                    {mode === modalMode && <motion.div layoutId="modal-tab" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'var(--accent-cyan)' }} />}
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                {modalMode === 'history' ? (
                  <table className="activities-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>DATE</th>
                        <th>ACTIVITY</th>
                        <th>TIME</th>
                        <th>AVG SPEED</th>
                        <th>AVG HR</th>
                        <th>POWER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segmentEfforts.map((effort, idx) => (
                        <tr key={effort.id}>
                          <td style={{ opacity: 0.4, fontWeight: 900 }}>{idx + 1}</td>
                          <td>{effort.start_date_local.split(' ')[0]}</td>
                          <td style={{ fontWeight: 700 }}>{effort.name}</td>
                          <td style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>{formatDuration(effort.moving_time)}</td>
                          <td>{getSpeed(selectedSegment.distance, effort.moving_time)} <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>km/h</span></td>
                          <td>{effort.average_heartrate ? `❤️ ${Math.round(effort.average_heartrate)}` : '--'}</td>
                          <td>{effort.average_watts ? `⚡ ${Math.round(effort.average_watts)}w` : '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="platform-card" style={{ padding: '1.5rem', height: '300px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1.5rem', opacity: 0.5 }}>TIME PERFORMANCE HISTORY</div>
                        <ResponsiveContainer width="100%" height="80%">
                            <LineChart data={segmentEfforts.map(e => ({
                                date: e.start_date_local.split(' ')[0],
                                seconds: e.moving_time.split(':').reduce((acc, time) => (60 * acc) + +time, 0)
                            })).reverse()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickFormatter={(v) => formatDuration(v)} />
                                <Tooltip 
                                    contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    formatter={(v) => [formatDuration(v), 'Time']}
                                />
                                <Line type="monotone" dataKey="seconds" stroke="var(--accent-cyan)" strokeWidth={3} dot={{ fill: 'var(--accent-cyan)', r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="platform-card" style={{ padding: '1.5rem', height: '300px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1.5rem', opacity: 0.5 }}>EFFORT VS HEART RATE</div>
                        <ResponsiveContainer width="100%" height="80%">
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis type="number" dataKey="hr" name="Heart Rate" stroke="rgba(255,255,255,0.3)" fontSize={10} label={{ value: 'Avg Heart Rate', position: 'insideBottom', offset: -5, fill: 'white', opacity: 0.4 }} />
                                <YAxis type="number" dataKey="time" name="Time" stroke="rgba(255,255,255,0.3)" fontSize={10} tickFormatter={(v) => formatDuration(v)} label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', fill: 'white', opacity: 0.4 }} />
                                <ZAxis type="number" range={[60, 400]} />
                                <Tooltip 
                                    cursor={{ strokeDasharray: '3 3' }}
                                    contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    formatter={(v, name) => name === 'Time' ? [formatDuration(v), name] : [v, name]}
                                />
                                <Scatter data={segmentEfforts.map(e => ({
                                    hr: e.average_heartrate || 0,
                                    time: e.moving_time.split(':').reduce((acc, time) => (60 * acc) + +time, 0)
                                })).filter(e => e.hr > 0)} fill="var(--accent-red)" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Segments;
