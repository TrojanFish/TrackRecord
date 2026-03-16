import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Calendar, Activity, Maximize2, Minimize2, Layers } from 'lucide-react';

const Heatmap = ({ activities, availableYears }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);
  
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [colorMode, setColorMode] = useState('Type'); // Type, Pace, Altitude
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hoveredActivity, setHoveredActivity] = useState(null);
  const coordsCache = useRef({});

  const decodePolyline = (str, precision = 5) => {
    if (coordsCache.current[str]) return coordsCache.current[str];
    
    let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, factor = Math.pow(10, precision);
    while (index < str.length) {
      let byte = null; shift = 0; result = 0;
      do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
      let lat_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
      shift = 0; result = 0;
      do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
      let lng_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += lat_change; lng += lng_change;
      coordinates.push([lat / factor, lng / factor]);
    }
    coordsCache.current[str] = coordinates;
    return coordinates;
  };

  const getPaceColor = (pace) => {
     // Pace is in min/km (lower is faster)
     if (pace < 4) return '#ef4444'; // Fast (Red)
     if (pace < 5) return '#f59e0b'; // Medium-Fast (Orange)
     if (pace < 6) return '#10b981'; // Steady (Green)
     return '#3b82f6'; // Relaxed (Blue)
  };

  useEffect(() => {
    if (!window.L || !mapRef.current) return;

    if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { 
            zoomControl: false, 
            attributionControl: false,
            fadeAnimation: true,
            preferCanvas: true
        }).setView([20, 0], 2);

        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
            maxZoom: 19 
        }).addTo(mapInstance.current);

        layerGroup.current = window.L.featureGroup().addTo(mapInstance.current);
    }

    renderRoutes();
  }, []);

  useEffect(() => {
    renderRoutes();
  }, [selectedYear, selectedType, colorMode, activities]);

  const renderRoutes = () => {
    if (!layerGroup.current) return;
    layerGroup.current.clearLayers();

    const filtered = activities.filter(a => {
        const yearMatch = selectedYear === 'All' || a.start_date_local.startsWith(selectedYear);
        const typeMatch = selectedType === 'All' || a.type === selectedType;
        return yearMatch && typeMatch && a.summary_polyline;
    });

    const bounds = [];
    filtered.forEach(activity => {
        const coords = decodePolyline(activity.summary_polyline);
        if (coords.length > 1) {
            let color = 'var(--accent-cyan)';
            
            if (colorMode === 'Type') {
                color = activity.type === 'Run' ? 'var(--accent-cyan)' : '#bd00ff';
            } else if (colorMode === 'Pace' && activity.type === 'Run') {
                const pace = (activity.moving_time_display ? 
                    (activity.moving_time_display.split(':').reduce((acc, time) => (60 * acc) + +time) / 60) : 
                    (activity.moving_time / 60)) / (activity.distance / 1000);
                color = getPaceColor(pace);
            }

            const poly = window.L.polyline(coords, { 
                color: color, 
                weight: 2.5, 
                opacity: 0.4,
                lineJoin: 'round',
                className: 'glow-polyline'
            }).addTo(layerGroup.current);

            poly.on('mouseover', () => {
                poly.setStyle({ opacity: 1, weight: 6, color: '#fff' });
                setHoveredActivity(activity);
            });
            poly.on('mouseout', () => {
                poly.setStyle({ opacity: 0.4, weight: 2.5, color: color });
                setHoveredActivity(null);
            });

            coords.forEach(c => bounds.push(c));
        }
    });

    if (bounds.length > 0 && mapInstance.current) {
        mapInstance.current.fitBounds(bounds, { padding: [60, 60], animate: true });
    }
  };

  const cities = activities.reduce((acc, curr) => {
     if (curr.location_city) {
        acc[curr.location_city] = (acc[curr.location_city] || 0) + 1;
     }
     return acc;
  }, {});

  const cityList = Object.entries(cities).sort((a, b) => b[1] - a[1]);

  const zoomToCity = (cityName) => {
    const cityActivities = activities.filter(a => a.location_city === cityName && a.summary_polyline);
    const bounds = [];
    cityActivities.forEach(a => {
        const coords = decodePolyline(a.summary_polyline);
        coords.forEach(c => bounds.push(c));
    });
    if (bounds.length > 0 && mapInstance.current) {
        mapInstance.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 13, animate: true });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`page-content heatmap-page ${isFullScreen ? 'fullscreen' : ''}`}
      style={{ 
          height: isFullScreen ? '100vh' : 'calc(100vh - 9rem)', 
          padding: 0, 
          margin: 0,
          position: isFullScreen ? 'fixed' : 'relative',
          top: isFullScreen ? 0 : 'auto',
          left: isFullScreen ? 0 : 'auto',
          width: isFullScreen ? '100vw' : '100%',
          zIndex: isFullScreen ? 2000 : 1
      }}
    >
      <div 
        ref={mapRef} 
        id="map" 
        style={{ 
          width: '100%', 
          height: '100%', 
          borderRadius: isFullScreen ? '0' : '24px',
          overflow: 'hidden',
          background: '#030712'
        }} 
      ></div>

      {/* Left Control Column (Title, Modes, Cities) */}
      <div style={{ 
        position: 'absolute', 
        top: '30px', 
        left: '30px', 
        zIndex: 2001, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '15px',
        maxWidth: '260px',
        maxHeight: 'calc(100% - 150px)'
      }}>
         {/* Title & Stats Bubble */}
         <div style={{ background: 'rgba(10, 22, 40, 0.85)', backdropFilter: 'blur(12px)', padding: '12px 20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '2px', color: 'var(--accent-cyan)', margin: 0 }}>ROUTE EXPLORER</h2>
            <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '2px' }}>{activities.length} TRACKS LOADED IN DB</div>
         </div>

         {/* Coloring Modes */}
         <div style={{ background: 'rgba(10, 22, 40, 0.8)', backdropFilter: 'blur(12px)', padding: '10px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '5px', flexShrink: 0 }}>
            {['Type', 'Pace'].map(mode => (
              <button 
                key={mode} 
                onClick={() => setColorMode(mode)}
                style={{
                   flex: 1,
                   padding: '10px 0',
                   borderRadius: '10px',
                   border: 'none',
                   fontSize: '0.7rem',
                   fontWeight: 800,
                   letterSpacing: '1px',
                   background: colorMode === mode ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)',
                   color: colorMode === mode ? 'black' : 'rgba(255,255,255,0.6)',
                   cursor: 'pointer',
                   transition: 'all 0.2s ease',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   lineHeight: 1
                }}
              >
                {mode.toUpperCase()}
              </button>
            ))}
         </div>

         {/* City Sidebar (Now inside the column) */}
         <div style={{
            background: 'rgba(10, 22, 40, 0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            overflowY: 'auto',
            flex: 1,
            scrollbarWidth: 'none'
         }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 900, opacity: 0.5, letterSpacing: '1px', margin: 0 }}>EXPLORE CITIES</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {cityList.slice(0, 15).map(([name, count]) => (
                 <button 
                   key={name}
                   onClick={() => zoomToCity(name)}
                   style={{
                     display: 'flex',
                     justifyContent: 'space-between',
                     alignItems: 'center',
                     background: 'rgba(255,255,255,0.03)',
                     border: '1px solid rgba(255,255,255,0.05)',
                     padding: '10px 14px',
                     borderRadius: '12px',
                     color: 'white',
                     cursor: 'pointer',
                     textAlign: 'left',
                     transition: 'all 0.3s'
                   }}
                   onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                   onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                 >
                   <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{name}</span>
                   <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{count}</span>
                 </button>
               ))}
            </div>
         </div>

         {/* Visual Legend (Now stacked inside the sidebar) */}
         <div style={{ 
            background: 'rgba(10, 22, 40, 0.85)', 
            backdropFilter: 'blur(12px)', 
            padding: '15px', 
            borderRadius: '15px', 
            border: '1px solid rgba(255,255,255,0.1)',
            flexShrink: 0 
         }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 900, opacity: 0.4, letterSpacing: '1px', marginBottom: '10px' }}>MAP LEGEND</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {colorMode === 'Type' ? (
                 <>
                  <div className="legend-item" style={{ fontSize: '0.7rem' }}><div className="dot run" /> RUNNING</div>
                  <div className="legend-item" style={{ fontSize: '0.7rem' }}><div className="dot ride" /> CYCLING</div>
                 </>
               ) : (
                 <>
                  <div className="legend-item" style={{ fontSize: '0.7rem' }}><div className="dot" style={{ background: '#ef4444' }} /> FAST (&lt;4:00)</div>
                  <div className="legend-item" style={{ fontSize: '0.7rem' }}><div className="dot" style={{ background: '#f59e0b' }} /> STEADY (5:00)</div>
                  <div className="legend-item" style={{ fontSize: '0.7rem' }}><div className="dot" style={{ background: '#3b82f6' }} /> EASY (&gt;6:00)</div>
                 </>
               )}
            </div>
         </div>
      </div>

      {/* Advanced Filters (Floating Right) */}
      <div className="map-controls-floating" style={{ top: '30px', right: '30px', padding: '15px 20px' }}>
         <div className="control-group">
            <div className="control-label"><Calendar size={12} /> PERIOD</div>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
               <option value="All">Life-time</option>
               {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
         </div>

         <div className="divider-v" />

         <div className="control-group">
            <div className="control-label"><Filter size={12} /> CATEGORY</div>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
               <option value="All">All Disciplines</option>
               <option value="Run">Running</option>
               <option value="Ride">Cycling</option>
            </select>
         </div>

         <div className="divider-v" />

         <button className="map-action-btn" onClick={() => setIsFullScreen(!isFullScreen)} style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
         </button>
      </div>

    </motion.div>
  );
};

export default Heatmap;
