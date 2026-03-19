import React, { useState, useEffect, useMemo } from 'react';
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
  Filter,
  RefreshCw
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ScatterChart, Scatter,
  ZAxis
} from 'recharts';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

const Segments = ({ sportType }) => {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentEfforts, setSegmentEfforts] = useState([]);
  const [modalMode, setModalMode] = useState('history'); // 'history' | 'charts'
  const [countryFilter, setCountryFilter] = useState('All');
  const [otherFilter, setOtherFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null); // { type: 'success' | 'error', text: string }

  const syncSegments = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/sync_segments?limit=20`);
      // Since it's a background task, we wait a bit and refresh multiple times
      let attempts = 0;
      const interval = setInterval(async () => {
        await fetchSegments();
        attempts++;
        if (attempts >= 3) clearInterval(interval);
      }, 5000);

      setSyncMessage({ type: 'success', text: 'Strava sync started (20 activities). Data will appear as it is processed.' });
      setTimeout(() => setSyncMessage(null), 8000);
    } catch (err) {
      console.error("Sync failed", err);
      setSyncMessage({ type: 'error', text: 'Sync failed. Please check backend logs or Strava connection.' });
      setTimeout(() => setSyncMessage(null), 6000);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, [sportType]);

  const fetchSegments = async () => {
    try {
      const url = sportType && sportType !== 'All' 
        ? `${API_BASE}/api/v1/segments?sport_type=${sportType}`
        : `${API_BASE}/api/v1/segments`;
      const res = await axios.get(url);
      setSegments(Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch segments", err);
      setSegments([]);
      setLoading(false);
    }
  };

  const fetchSegmentEfforts = async (segmentId) => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/segment_efforts/${segmentId}`);
      setSegmentEfforts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch segment efforts", err);
      setSegmentEfforts([]);
    }
  };

  const handleSegmentClick = (segment) => {
    setSelectedSegment(segment);
    fetchSegmentEfforts(segment.id);
    setIsModalOpen(true);
  };

  const filteredSegments = React.useMemo(() => {
    if (!Array.isArray(segments)) return [];
    const term = searchTerm.toLowerCase();
    return segments.filter(s => {
      // Search term
      const matchesSearch = s.name.toLowerCase().includes(term) ||
      (s.city && s.city.toLowerCase().includes(term));
      
      // Country
      const matchesCountry = countryFilter === 'All' || s.country === countryFilter;
      
      // Other
      let matchesOther = true;
      if (otherFilter === 'KOM/QOM Only') {
        matchesOther = s.effort_count > 0 && s.best_rank === 1;
      } else if (otherFilter === 'Starred Only') {
        matchesOther = s.starred === true;
      }

      return matchesSearch && matchesCountry && matchesOther;
    });
  }, [segments, searchTerm, countryFilter, otherFilter]);

  const formatCity = (city) => city ? city.replace('市', '') : 'Unknown';

  const countries = useMemo(() => {
    if (!Array.isArray(segments)) return ['All'];
    const c = new Set(segments.map(s => s.country).filter(Boolean));
    return ['All', ...Array.from(c).sort()];
  }, [segments]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.01 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const formatDuration = (val) => {
    if (!val) return '--';
    let timeStr = String(val);
    if (timeStr.includes(' ')) timeStr = timeStr.split(' ')[1];
    return timeStr.split('.')[0];
  };

  // Converts "1970-01-01 HH:MM:SS.sss" or "HH:MM:SS" to total seconds
  const parseToSecs = (val) => {
    if (!val) return 0;
    let t = String(val);
    if (t.includes(' ')) t = t.split(' ')[1];
    t = t.split('.')[0];
    const parts = t.split(':');
    return (parseInt(parts[0] || 0) * 3600) + (parseInt(parts[1] || 0) * 60) + (parseInt(parts[2] || 0));
  };

  const formatSecondsToTime = (secs) => {
    if (!secs || isNaN(secs)) return '--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  };

  const formatPace = (distMeters, timeStr) => {
      if (!timeStr) return '--';
      try {
          const tOnly = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
          const parts = tOnly.split(':');
          const seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
          if (seconds === 0 || distMeters === 0) return '--';
          const paceSeconds = seconds / (distMeters / 1000);
          const m = Math.floor(paceSeconds / 60);
          const s = Math.round(paceSeconds % 60);
          return `${m}:${s < 10 ? '0' : ''}${s}`;
      } catch { return '--'; }
  };

  const getSpeed = (distMeters, timeStr) => {
      if (!timeStr) return '--';
      try {
          const tOnly = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
          const parts = tOnly.split(':');
          const seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
          if (seconds === 0) return '--';
          return ((distMeters / 1000) / (seconds / 3600)).toFixed(1);
      } catch { return '--'; }
  };

  const isRun = sportType === 'Run';

  return (
    <motion.div 
      variants={container} 
      initial="hidden" 
      animate="show" 
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content" 
      style={{ paddingBottom: '5rem' }}
    >
      
      {/* Top Search & Filter Bar */}
      <div className="platform-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }} />
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
          <select 
            disabled={sportType !== 'All'}
            value={sportType !== 'All' ? sportType : 'All'}
            className="platform-card" 
            style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '8px', fontSize: '0.85rem', opacity: sportType !== 'All' ? 0.6 : 1 }}
          >
            <option value="All">All Sports</option>
            <option value="Run">Running</option>
            <option value="Ride">Cycling</option>
          </select>
        </div>

        <div className="filter-group">
          <label><MapPin size={14} /> COUNTRY</label>
          <select 
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="platform-card" 
            style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '8px', fontSize: '0.85rem' }}
          >
            {countries.map(c => <option key={c} value={c}>{c === 'All' ? 'All Locations' : c}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label><Filter size={14} /> OTHER</label>
          <select 
            value={otherFilter}
            onChange={(e) => setOtherFilter(e.target.value)}
            className="platform-card" 
            style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '8px', fontSize: '0.85rem' }}
          >
            <option value="All">All Segments</option>
            <option value="Starred Only">Starred Only</option>
            <option value="KOM/QOM Only">KOM/QOM Only</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.7, letterSpacing: '1px' }}>
          {filteredSegments.length} SEGMENTS FOUND
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {syncMessage && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '8px',
              background: syncMessage.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: syncMessage.type === 'success' ? '#10b981' : '#ef4444',
              border: `1px solid ${syncMessage.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
            }}>
              {syncMessage.text}
            </span>
          )}
          <button
            onClick={syncSegments}
            disabled={isSyncing}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)',
              fontSize: '0.75rem', fontWeight: 700, cursor: isSyncing ? 'default' : 'pointer',
              opacity: isSyncing ? 0.5 : 1, letterSpacing: '0.5px'
            }}
          >
            <RefreshCw size={12} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            {isSyncing ? 'SYNCING...' : 'SYNC'}
          </button>
        </div>
      </div>

      {/* Segments Table */}
      <div className="platform-card" style={{ padding: '0', overflowX: 'auto' }}>
        {filteredSegments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '6rem 2rem', opacity: 0.3 }}>
            <RouteIcon size={64} style={{ marginBottom: '1.5rem', strokeWidth: 1 }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>No segments matching filters</h3>
            <p style={{ fontSize: '0.9rem' }}>Try syncing more data or check your <a href="https://www.strava.com/athlete/segments" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>Strava Segments</a>.</p>
          </div>
        ) : (
          <table className="activities-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '2rem' }}>SEGMENT NAME</th>
                <th>PB DATE</th>
                <th>BEST TIME</th>
                <th>{isRun ? 'PACE' : 'AVG SPEED'}</th>
                <th>DIST</th>
                <th>GRADE</th>
                <th style={{ paddingRight: '2rem', textAlign: 'right' }}>EFFORTS #</th>
              </tr>
            </thead>
            <tbody>
              {filteredSegments.map((segment) => (
                <motion.tr 
                  key={segment.id || Math.random()} 
                  variants={item}
                  onClick={() => handleSegmentClick(segment)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ paddingLeft: '2rem' }}>
                    <div style={{ color: 'white', fontWeight: 700 }}>{segment.name}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '2px' }}>{formatCity(segment.city)}</div>
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
                    {isRun ? (
                      <div style={{ fontWeight: 600 }}>{formatPace(segment.distance, segment.best_time)} <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>/km</span></div>
                    ) : (
                      <div style={{ fontWeight: 600 }}>{getSpeed(segment.distance, segment.best_time)} <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>km/h</span></div>
                    )}
                  </td>
                  <td>{(segment.distance / 1000).toFixed(2)} km</td>
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
        )}
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><RouteIcon size={14} /> {(selectedSegment.distance / 1000).toFixed(2)}km</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={14} /> {selectedSegment.average_grade}% avg grade</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> {formatCity(selectedSegment.city)}</span>
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
                      fontWeight: 800, fontSize: '0.75rem', letterSpacing: '1px', opacity: mode === modalMode ? 1 : 0.6, cursor: 'pointer',
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
                        <th>{isRun ? 'PACE' : 'AVG SPEED'}</th>
                        <th>AVG HR</th>
                        <th>POWER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segmentEfforts.map((effort, idx) => (
                        <tr key={effort.id}>
                          <td style={{ opacity: 0.7, fontWeight: 900 }}>{idx + 1}</td>
                          <td>{effort.start_date_local.split(' ')[0]}</td>
                          <td style={{ fontWeight: 700 }}>{effort.name}</td>
                          <td style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>{formatDuration(effort.moving_time)}</td>
                          <td>
                            {isRun ? (
                               <>{formatPace(selectedSegment.distance, effort.moving_time)} <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>/km</span></>
                            ) : (
                               <>{getSpeed(selectedSegment.distance, effort.moving_time)} <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>km/h</span></>
                            )}
                          </td>
                          <td>{effort.average_heartrate ? `❤️ ${Math.round(effort.average_heartrate)}` : '--'}</td>
                          <td>{effort.average_watts ? `⚡ ${Math.round(effort.average_watts)}w` : '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="platform-card" style={{ padding: '1.5rem', height: '300px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1.5rem', opacity: 0.7 }}>TIME PERFORMANCE HISTORY</div>
                        <ResponsiveContainer width="100%" height="80%">
                            <LineChart data={segmentEfforts.map(e => ({
                                date: e.start_date_local.split(' ')[0],
                                seconds: parseToSecs(e.moving_time)
                            })).reverse()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickFormatter={formatSecondsToTime} />
                                <Tooltip
                                    contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    formatter={(v) => [formatSecondsToTime(v), 'Time']}
                                />
                                <Line type="monotone" dataKey="seconds" stroke="var(--accent-cyan)" strokeWidth={3} dot={{ fill: 'var(--accent-cyan)', r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="platform-card" style={{ padding: '1.5rem', height: '300px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '1.5rem', opacity: 0.7 }}>EFFORT VS HEART RATE</div>
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
                                    time: parseToSecs(e.moving_time)
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
