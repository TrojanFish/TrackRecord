import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Filter, ArrowUpDown, ChevronDown, 
  MapPin, Calendar, Clock, Heart, Zap, ExternalLink,
  Map as MapIcon, X, Maximize2, Activity as ActivityIcon,
  TrendingUp, Timer, ChevronRight, Footprints, Flame
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import polyline from 'polyline';
import 'leaflet/dist/leaflet.css';

const Activities = ({ stats, setActiveTab, initialSearch, onSearchClear, sportType }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const isGlobalFilterActive = sportType !== 'All';
  const [internalFilterType, setInternalFilterType] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'start_date_local', direction: 'desc' });
  const [distanceFilter, setDistanceFilter] = useState('All');
  const [commuteFilter, setCommuteFilter] = useState('All'); // All, Commute, Exclude
  const [workoutTypeFilter, setWorkoutTypeFilter] = useState('All'); // All, Race, Workout, Long Run
  const [countryFilter, setCountryFilter] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const filterType = isGlobalFilterActive ? sportType : internalFilterType;

  useEffect(() => {
    if (initialSearch) {
      setSearchTerm(initialSearch);
      if (onSearchClear) onSearchClear(); // Clear it from App state once consumed
    }
  }, [initialSearch, onSearchClear]);

  if (!stats) return null;

  // Formatting helpers
  const formatPace = (distM, timeStr, type) => {
    if (!distM || !timeStr) return '--';
    
    // Handle timeStr that might include a date like "1970-01-01 02:04:42"
    const timeOnly = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
    const parts = timeOnly.split(':');
    const totalSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    const km = distM / 1000;
    
    const rideTypes = ['Ride', 'VirtualRide', 'Velomobile', 'E-BikeRide'];
    if (rideTypes.includes(type)) {
      return `${(km / (totalSeconds / 3600)).toFixed(1)} km/h`;
    }
    
    const paceSeconds = totalSeconds / km;
    const m = Math.floor(paceSeconds / 60);
    const s = Math.floor(paceSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}/km`;
  };

  const formatLocationShort = (locStr) => {
    if (!locStr) return 'Main Route';
    const parts = locStr.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const country = parts[parts.length - 1];
      if (country === '中国' || country === 'China') {
        // Try to find the city (ends with 市)
        const cityWithShi = parts.find(p => p.endsWith('市'));
        if (cityWithShi) return `中国 ${cityWithShi.replace('市', '')}`;
        
        // If no 市 found, it might be a district. We want the city.
        // Usually: [City], [District], [Province], China
        // Or: [District], [City], [Province], China
        // We'll try to skip known district suffixes like '区', '县'
        const cityCandidate = parts.find(p => !p.endsWith('区') && !p.endsWith('县') && p !== '中国' && p !== country);
        return `中国 ${cityCandidate || parts[0]}`;
      }
      const stateOrCity = parts[parts.length - 2] || parts[0];
      return `${stateOrCity}, ${country}`;
    }
    return locStr;
  };

  const decodePolyline = (str) => {
    if (!str) return [];
    return polyline.decode(str);
  };

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const filteredActivities = useMemo(() => {
    let items = [...(stats.recent_activities || [])];

    // Search filter
    if (searchTerm) {
      items = items.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Type filter
    if (filterType !== 'All') {
      items = items.filter(a => a.type === filterType);
    }

    // Distance filter
    if (distanceFilter === 'Short') {
      items = items.filter(a => a.distance < (filterType === 'Ride' ? 20000 : 5000));
    }
    if (distanceFilter === 'Medium') {
      const min = (filterType === 'Ride' ? 20000 : 5000);
      const max = (filterType === 'Ride' ? 50000 : 15000);
      items = items.filter(a => a.distance >= min && a.distance < max);
    }
    if (distanceFilter === 'Long') {
      items = items.filter(a => a.distance >= (filterType === 'Ride' ? 50000 : 15000));
    }

    // Commute filter
    if (commuteFilter === 'Commute') items = items.filter(a => a.commute === 1);
    if (commuteFilter === 'Exclude') items = items.filter(a => a.commute === 0);

    // Workout Type filter
    if (workoutTypeFilter !== 'All') {
      const typeMap = { 'Race': [1, 11], 'Workout': [3, 12], 'Long Run': [2] };
      items = items.filter(a => typeMap[workoutTypeFilter]?.includes(a.workout_type));
    }

    // Country filter
    if (countryFilter !== 'All') {
      items = items.filter(a => formatLocationShort(a.location_country) === countryFilter);
    }

    // Year filter
    if (selectedYear !== 'All') {
      items = items.filter(a => a.start_date_local.startsWith(selectedYear));
    }

    // Sorting
    items.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'distance') {
        aVal = a.distance; bVal = b.distance;
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return items;
  }, [stats.recent_activities, searchTerm, filterType, distanceFilter, commuteFilter, workoutTypeFilter, countryFilter, selectedYear, sortConfig]);

  const countries = useMemo(() => {
    const c = new Set(stats.recent_activities?.map(a => formatLocationShort(a.location_country)).filter(Boolean));
    return ['All', ...Array.from(c).sort()];
  }, [stats.recent_activities]);

  const years = useMemo(() => {
    const y = new Set(stats.recent_activities?.map(a => a.start_date_local.split('-')[0]));
    return ['All', ...Array.from(y).sort((a, b) => b - a)];
  }, [stats.recent_activities]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="page-content activity-center"
    >
      {/* Search & Filter Header */}
      <div className="platform-card" style={{ padding: '1.5rem', marginBottom: '2rem', position: 'relative', zIndex: 10 }}>
         <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
               <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
               <input 
                 type="text" 
                 placeholder="Search activity name..." 
                 className="search-input-fancy"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 style={{ width: '100%', paddingLeft: '45px' }}
               />
            </div>

            {/* Type Filter - Only show if no global filter active */}
            {!isGlobalFilterActive && (
              <div className="filter-group">
                <label><Filter size={14} /> TYPE</label>
                <select value={internalFilterType} onChange={(e) => setInternalFilterType(e.target.value)}>
                    <option value="All">All Types</option>
                    <option value="Run">Running</option>
                    <option value="Ride">Cycling</option>
                    <option value="Walk">Walking</option>
                </select>
              </div>
            )}

            {/* Distance Filter */}
            <div className="filter-group">
               <label><Zap size={14} /> RANGE</label>
               <select value={distanceFilter} onChange={(e) => setDistanceFilter(e.target.value)}>
                  <option value="All">Any Distance</option>
                  {filterType === 'Ride' ? (
                    <>
                      <option value="Short">&lt; 30km</option>
                      <option value="Medium">30 - 80km</option>
                      <option value="Long">&gt; 80km</option>
                    </>
                  ) : filterType === 'Walk' || filterType === 'Hike' ? (
                    <>
                      <option value="Short">&lt; 3km</option>
                      <option value="Medium">3 - 10km</option>
                      <option value="Long">&gt; 10km</option>
                    </>
                  ) : (
                    <>
                      <option value="Short">&lt; 5km</option>
                      <option value="Medium">5 - 15km</option>
                      <option value="Long">&gt; 15km</option>
                    </>
                  )}
               </select>
            </div>

            {/* Country Filter */}
            <div className="filter-group">
               <label><MapPin size={14} /> COUNTRY</label>
               <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
                  {countries.map(c => <option key={c} value={c}>{c === 'All' ? 'All Countries' : c}</option>)}
               </select>
            </div>

            {/* Year Filter */}
            <div className="filter-group">
               <label><Calendar size={14} /> YEAR</label>
               <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  {years.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
               </select>
            </div>

            {/* Other Filters */}
            <div className="filter-group">
               <label><ChevronDown size={14} /> OTHER</label>
               <select 
                 value={`${commuteFilter}-${workoutTypeFilter}`} 
                 onChange={(e) => {
                    const [c, w] = e.target.value.split('-');
                    if (c) setCommuteFilter(c);
                    if (w) setWorkoutTypeFilter(w);
                 }}
               >
                  <option value="All-All">All Tags</option>
                  <option value="Commute-All">Only Commute</option>
                  <option value="Exclude-All">Exclude Commute</option>
                  <option value="All-Race">Races Only</option>
                  <option value="All-Workout">Workouts Only</option>
                  <option value="All-Long Run">Long Runs Only</option>
               </select>
            </div>

            <div style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 700, opacity: 0.8 }}>
               FOUND {filteredActivities.length} ACTIVITIES
            </div>
         </div>
      </div>

      {/* Main Table Container */}
      <div className="platform-card table-scroll-container" style={{ padding: '0' }}>
        <table className="activities-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('start_date_local')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>DATE <ArrowUpDown size={12} /></div>
              </th>
              <th>NAME / LOCATION</th>
              <th>TYPE</th>
              <th onClick={() => handleSort('distance')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>DISTANCE / CLIMB <ArrowUpDown size={12} /></div>
              </th>
              <th>PACE / GAP / DUR</th>
              <th>BIO & POWER</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
            {filteredActivities.map((activity, idx) => (
              <motion.tr 
                key={activity.run_id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => {
                  setSelectedActivity(activity);
                  setIsModalOpen(true);
                }}
                className={`${selectedActivity?.run_id === activity.run_id ? 'selected' : ''} type-${activity.type.toLowerCase()}`}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 800 }}>{activity.start_date_local.split(' ')[0]}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{activity.start_date_local.split(' ')[1]}</span>
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 700 }}>{activity.name}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 400, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={10} /> {formatLocationShort(activity.location_country) || activity.location_city || 'Main Route'}
                        </div>
                    </div>
                </td>
                <td>
                  <span className={`badge ${activity.type.toLowerCase()}`}>
                    {activity.type.toUpperCase()}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div>
                      <b style={{ color: activity.type === 'Run' ? '#ff3366' : 'var(--accent-cyan)', fontSize: '1rem' }}>{(activity.distance / 1000).toFixed(2)}</b>
                      <span style={{ fontSize: '0.7rem', opacity: 0.8, marginLeft: '4px' }}>KM</span>
                    </div>
                    {activity.elevation_gain > 0 && (
                      <span style={{ fontSize: '0.65rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={10} /> {activity.elevation_gain.toFixed(0)}m
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{formatPace(activity.distance, activity.moving_time, activity.type)}</span>
                       {activity.gap_pace && activity.gap_pace !== formatPace(activity.distance, activity.moving_time, activity.type) && (
                         <span style={{ fontSize: '0.7rem', color: activity.type === 'Run' ? '#ff3366' : 'var(--accent-cyan)', fontWeight: 600 }}>
                           GAP: {activity.gap_pace}
                         </span>
                       )}
                       <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{activity.moving_time.includes(' ') ? activity.moving_time.split(' ')[1].split('.')[0] : activity.moving_time.split('.')[0]}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {activity.average_heartrate > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                          <Heart size={12} fill={activity.average_heartrate > 160 ? "#ef4444" : "none"} /> {Math.round(activity.average_heartrate)}
                        </div>
                      )}
                       {activity.average_cadence > 0 && (
                         <div style={{ fontSize: '0.75rem', color: activity.type === 'Run' ? '#ff3366' : 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                           <Footprints size={12} /> {Math.round(activity.average_cadence < 120 && activity.type.toLowerCase().includes('run') ? activity.average_cadence * 2 : activity.average_cadence)}
                         </div>
                       )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {activity.calories > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                          <Flame size={12} fill="#f59e0b" /> {activity.calories}
                        </div>
                      )}
                      {activity.average_watts > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                          <Zap size={12} fill="#8b5cf6" /> {Math.round(activity.average_watts)}W
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                   <button 
                     className="icon-btn-circle" 
                     title="View Details"
                     onClick={() => {
                        setSelectedActivity(activity);
                        setIsModalOpen(true);
                     }}
                   >
                      <Maximize2 size={16} />
                   </button>
                </td>
              </motion.tr>
            ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '2rem', textAlign: 'center', opacity: 0.6, fontSize: '0.75rem' }}>
         Showing {filteredActivities.length} results. Use filters to narrow down your search.
      </div>

      {/* Activity Detail Modal */}
      <AnimatePresence>
        {isModalOpen && selectedActivity && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="activity-detail-panel"
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div className={`badge ${selectedActivity.type.toLowerCase()}`} style={{ padding: '8px 12px' }}>
                        {selectedActivity.type.toUpperCase()}
                    </div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{selectedActivity.name}</h2>
                  </div>
                  <button className="close-panel-btn" onClick={() => setIsModalOpen(false)}>
                    <X size={24} />
                  </button>
              </div>

              <div className="panel-content">
                  {/* Minimized Map Preview */}
                  <div className="detail-map-container" style={{ height: '300px', borderRadius: '24px', overflow: 'hidden', marginBottom: '2.5rem', background: '#0a1628' }}>
                    {selectedActivity.summary_polyline ? (
                      <MapContainer 
                        center={decodePolyline(selectedActivity.summary_polyline)[0]} 
                        zoom={13} 
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                      >
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                         <Polyline 
                           positions={decodePolyline(selectedActivity.summary_polyline)} 
                           color={selectedActivity.type === 'Run' ? '#ff3366' : 'var(--accent-cyan)'} 
                           weight={4} 
                           opacity={0.8}
                         />
                      </MapContainer>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                         <MapPin size={48} />
                         <span>No GPS data available</span>
                      </div>
                    )}
                  </div>

                  {/* High Level Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    <div className="detail-stat-box">
                        <span className="label">DISTANCE</span>
                        <span className="value">{(selectedActivity.distance / 1000).toFixed(2)} <small>KM</small></span>
                    </div>
                    <div className="detail-stat-box">
                        <span className="label">PACE / SPEED</span>
                        <span className="value">
                            {formatPace(selectedActivity.distance, selectedActivity.moving_time, selectedActivity.type)}
                             {selectedActivity.gap_pace && selectedActivity.gap_pace !== formatPace(selectedActivity.distance, selectedActivity.moving_time, selectedActivity.type) && (
                                 <div style={{ fontSize: '0.7rem', color: selectedActivity.type === 'Run' ? '#ff3366' : 'var(--accent-cyan)', marginTop: '4px' }}>
                                     GAP: {selectedActivity.gap_pace}
                                 </div>
                             )}
                        </span>
                    </div>
                    <div className="detail-stat-box">
                        <span className="label">MOVING TIME</span>
                        <span className="value">{selectedActivity.moving_time.includes(' ') ? selectedActivity.moving_time.split(' ')[1].split('.')[0] : selectedActivity.moving_time.split('.')[0]}</span>
                    </div>
                    <div className="detail-stat-box">
                        <span className="label">ELEVATION GAIN</span>
                        <span className="value">{selectedActivity.elevation_gain?.toFixed(0) || 0} <small>M</small></span>
                    </div>
                    <div className="detail-stat-box">
                        <span className="label">EST. AVG HEART RATE</span>
                        <span className="value" style={{ color: '#ef4444' }}>{selectedActivity.average_heartrate?.toFixed(0) || '--'} <small>BPM</small></span>
                    </div>
                  </div>

                  <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ActivityIcon size={16} color="var(--accent-cyan)" /> ACTIVITY INSIGHTS
                      </h4>
                      <p style={{ fontSize: '0.85rem', opacity: 0.8, lineHeight: '1.6' }}>
                        This {selectedActivity.type} session covered {(selectedActivity.distance / 1000).toFixed(1)}km in {selectedActivity.location_city || 'unknown location'}. 
                        Your intensity factor suggests a solid training stress of {Math.round(selectedActivity.distance / 100)} points.
                      </p>
                  </div>
              </div>

              <div className="panel-footer">
                  <button 
                    className="full-report-btn"
                    onClick={() => {
                        setIsModalOpen(false);
                        setActiveTab('Analytics');
                    }}
                  >
                     OPEN FULL PERFORMANCE ANALYSIS <ChevronRight size={18} />
                  </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Activities;
