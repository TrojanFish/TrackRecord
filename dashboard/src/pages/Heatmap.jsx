import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Maximize2, Minimize2, Eye, EyeOff, MapPin } from 'lucide-react';

const Heatmap = ({ activities, availableYears, sportType }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);

  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedType, setSelectedType] = useState(sportType || 'All');
  const [colorMode, setColorMode] = useState('Type');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hoveredActivity, setHoveredActivity] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const coordsCache = useRef({});

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    if (sportType && sportType !== 'All') setSelectedType(sportType);
  }, [sportType]);

  const isRun = sportType === 'Run';
  const themeColor = isRun ? '#ff3366' : '#06b6d4';

  const decodePolyline = (str, precision = 5) => {
    if (coordsCache.current[str]) return coordsCache.current[str];
    let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0,
      factor = Math.pow(10, precision);
    while (index < str.length) {
      let byte = null; shift = 0; result = 0;
      do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
      lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
      shift = 0; result = 0;
      do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
      lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
      coordinates.push([lat / factor, lng / factor]);
    }
    coordsCache.current[str] = coordinates;
    return coordinates;
  };

  const getMetricColor = (val, type) => {
    if (type === 'Run') {
      if (val < 4) return '#ef4444';
      if (val < 5) return '#f59e0b';
      if (val < 6) return '#10b981';
      return '#3b82f6';
    } else {
      if (val >= 35) return '#ef4444';
      if (val >= 28) return '#f59e0b';
      if (val >= 20) return '#10b981';
      return '#3b82f6';
    }
  };

  useEffect(() => {
    if (!window.L || !mapRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = window.L.map(mapRef.current, {
        zoomControl: false, attributionControl: false, fadeAnimation: true
      }).setView([20, 0], 2);
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 })
        .addTo(mapInstance.current);
      layerGroup.current = window.L.featureGroup().addTo(mapInstance.current);
    }
    renderRoutes();
  }, []);

  useEffect(() => { renderRoutes(); }, [selectedYear, selectedType, colorMode, activities]);

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
        let color = themeColor;
        if (colorMode === 'Type') {
          color = (!sportType || sportType === 'All')
            ? (activity.type === 'Run' ? '#ff3366' : '#06b6d4')
            : themeColor;
        } else if (colorMode === 'Pace') {
          const isActivityRun = ['Run', 'TrailRun', 'VirtualRun'].includes(activity.type);
          const distKm = activity.distance / 1000;
          const movingStr = activity.moving_time || '';
          const parts = movingStr.includes(' ') ? movingStr.split(' ')[1].split(':') : movingStr.split(':');
          const secs = parts.reduce((acc, t, i) => acc + parseInt(t || 0) * [3600, 60, 1][i], 0);
          color = isActivityRun
            ? getMetricColor(secs / 60 / distKm, 'Run')
            : getMetricColor(distKm / (secs / 3600), 'Ride');
        }
        const poly = window.L.polyline(coords, { color, weight: 2.5, opacity: 0.6, lineJoin: 'round', className: 'glow-polyline' })
          .addTo(layerGroup.current);
        poly.on('mouseover', () => { poly.setStyle({ opacity: 1, weight: 6, color: '#fff' }); setHoveredActivity(activity); });
        poly.on('mouseout',  () => { poly.setStyle({ opacity: 0.6, weight: 2.5, color }); setHoveredActivity(null); });
        coords.forEach(c => bounds.push(c));
      }
    });
    if (bounds.length > 0 && mapInstance.current)
      mapInstance.current.fitBounds(bounds, { padding: [60, 60], animate: true });
  };

  const filteredCount = useMemo(() => activities.filter(a => {
    const yearMatch = selectedYear === 'All' || a.start_date_local?.startsWith(selectedYear);
    const typeMatch = selectedType === 'All' || a.type === selectedType;
    return yearMatch && typeMatch && a.summary_polyline;
  }).length, [activities, selectedYear, selectedType]);

  const formatPaceHeatmap = (a) => {
    const isActivityRun = ['Run', 'TrailRun'].includes(a.type);
    const distKm = a.distance / 1000;
    const movingStr = a.moving_time || '';
    const parts = movingStr.includes(' ') ? movingStr.split(' ')[1].split(':') : movingStr.split(':');
    const secs = parts.reduce((acc, t, i) => acc + parseInt(t || 0) * [3600, 60, 1][i], 0);
    if (!secs || !distKm) return '--';
    if (isActivityRun) {
      const p = secs / distKm;
      return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}/km`;
    }
    return `${(distKm / (secs / 3600)).toFixed(1)} km/h`;
  };

  const cityList = useMemo(() => {
    const cities = {};
    activities.forEach(a => { if (a.location_city) cities[a.location_city] = (cities[a.location_city] || 0) + 1; });
    return Object.entries(cities).sort((a, b) => b[1] - a[1]);
  }, [activities]);

  const zoomToCity = (cityName) => {
    const bounds = [];
    activities.filter(a => a.location_city === cityName && a.summary_polyline)
      .forEach(a => decodePolyline(a.summary_polyline).forEach(c => bounds.push(c)));
    if (bounds.length > 0 && mapInstance.current)
      mapInstance.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 13, animate: true });
  };

  const legendItems = colorMode === 'Type'
    ? [
        ...(!sportType || sportType === 'All' || sportType === 'Run' ? [{ color: '#ff3366', label: 'RUNNING' }] : []),
        ...(!sportType || sportType === 'All' || sportType === 'Ride' ? [{ color: '#06b6d4', label: 'CYCLING' }] : []),
      ]
    : [
        { color: '#ef4444', label: isRun ? 'FAST <4:00' : 'FAST >35km/h' },
        { color: '#f59e0b', label: isRun ? 'STEADY 5:00' : 'STEADY 28km/h' },
        { color: '#10b981', label: isRun ? 'EASY 6:00' : 'EASY 20km/h' },
        { color: '#3b82f6', label: isRun ? 'SLOW >6:00' : 'SLOW <20km/h' },
      ];

  // ── shared style tokens ──────────────────────────────────────────────────
  const glass = {
    background: 'rgba(8, 18, 36, 0.88)',
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  const selectStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'white',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '6px 10px',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

  const iconBtnStyle = {
    ...glass,
    borderRadius: '10px',
    color: 'white',
    cursor: 'pointer',
    padding: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`page-content heatmap-page ${isFullScreen ? 'fullscreen' : ''}`}
      style={{
        height: isFullScreen ? '100vh' : 'calc(100vh - 9rem)',
        padding: 0, margin: 0,
        position: isFullScreen ? 'fixed' : 'relative',
        top: isFullScreen ? 0 : 'auto',
        left: isFullScreen ? 0 : 'auto',
        width: isFullScreen ? '100vw' : '100%',
        zIndex: isFullScreen ? 2000 : 1,
      }}
    >
      {/* ── Map canvas ─────────────────────────────────────────────────── */}
      <div
        ref={mapRef}
        id="map"
        style={{
          width: '100%', height: '100%',
          borderRadius: isFullScreen ? '0' : '24px',
          overflow: 'hidden', background: '#030712',
        }}
      />

      {/* ── Top control bar ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        right: '16px',
        zIndex: 2010,
        ...glass,
        borderRadius: '14px',
        padding: isMobile ? '10px 12px' : '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '8px' : '10px',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        {/* Title */}
        <div style={{ flex: isMobile ? '1 1 100%' : '0 0 auto', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '2px', color: themeColor }}>
            {sportType && sportType !== 'All' ? sportType.toUpperCase() + ' ' : ''}ROUTE EXPLORER
          </span>
          <span style={{ fontSize: '0.6rem', opacity: 0.45, fontWeight: 600 }}>
            {filteredCount} / {activities.length}
          </span>
        </div>

        {/* Divider — desktop only */}
        {!isMobile && <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />}

        {/* Period */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <Calendar size={11} opacity={0.4} />
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={selectStyle}>
            <option value="All">All years</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Category */}
        {(!sportType || sportType === 'All') && (
          <select value={selectedType} onChange={e => setSelectedType(e.target.value)} style={selectStyle}>
            <option value="All">All types</option>
            <option value="Run">Running</option>
            <option value="Ride">Cycling</option>
          </select>
        )}

        {/* Color mode toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '9px', gap: '3px', flexShrink: 0 }}>
          {[['Type', 'TYPE'], ['Pace', isRun ? 'PACE' : 'SPEED']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setColorMode(key)}
              style={{
                padding: '5px 10px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '0.65rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: colorMode === key ? themeColor : 'transparent',
                color: colorMode === key ? (isRun ? '#fff' : '#000') : 'rgba(255,255,255,0.5)',
              }}
            >{label}</button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* City panel toggle */}
        <button
          onClick={() => setPanelOpen(o => !o)}
          style={{ ...iconBtnStyle, gap: '5px', padding: '6px 10px', fontSize: '0.65rem', fontWeight: 800 }}
          title={panelOpen ? 'Hide cities' : 'Show cities'}
        >
          {panelOpen ? <EyeOff size={14} /> : <Eye size={14} />}
          {!isMobile && <span style={{ opacity: 0.7 }}>CITIES</span>}
        </button>

        {/* Fullscreen */}
        <button onClick={() => setIsFullScreen(f => !f)} style={iconBtnStyle} title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* ── City + legend panel ──────────────────────────────────────────── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="city-panel"
            initial={{ opacity: 0, scale: 0.96, y: isMobile ? 20 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: isMobile ? 20 : -8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              ...(isMobile
                ? { bottom: '16px', left: '16px', right: '16px' }
                : { top: '76px', left: '16px', width: '230px', maxHeight: 'calc(100% - 110px)' }
              ),
              zIndex: 2005,
              ...glass,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Cities header */}
            <div style={{ padding: isMobile ? '10px 14px 6px' : '14px 16px 8px', flexShrink: 0 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 900, opacity: 0.5, letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin size={10} /> EXPLORE CITIES
              </div>
            </div>

            {/* City list */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              gap: '4px',
              padding: isMobile ? '0 10px 10px' : '0 10px',
              overflowX: isMobile ? 'auto' : 'hidden',
              overflowY: isMobile ? 'hidden' : 'auto',
              flex: isMobile ? '0 0 auto' : 1,
              scrollbarWidth: 'none',
              flexWrap: 'nowrap',
            }}>
              {cityList.slice(0, isMobile ? 20 : 15).map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => { zoomToCity(name); if (isMobile) setPanelOpen(false); }}
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: isMobile ? 'center' : 'space-between',
                    alignItems: 'center',
                    gap: isMobile ? '2px' : '0',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: isMobile ? '8px 12px' : '8px 12px',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: isMobile ? 'center' : 'left',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                    whiteSpace: isMobile ? 'nowrap' : 'normal',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{name}</span>
                  <span style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: 600 }}>{count}</span>
                </button>
              ))}
            </div>

            {/* Legend — desktop: below cities; mobile: inline horizontal */}
            <div style={{
              flexShrink: 0,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              gap: isMobile ? '8px 14px' : '7px',
            }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 900, opacity: 0.4, letterSpacing: '1px', width: isMobile ? '100%' : 'auto' }}>LEGEND</div>
              {legendItems.map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.65rem', opacity: 0.7, fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hover activity tooltip ───────────────────────────────────────── */}
      <AnimatePresence>
        {hoveredActivity && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 2100, ...glass, borderRadius: '12px',
              padding: '10px 18px', display: 'flex', gap: '16px', alignItems: 'center',
              pointerEvents: 'none', whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '0.6rem', opacity: 0.45 }}>{hoveredActivity.start_date_local?.split(' ')[0]}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>{hoveredActivity.name}</span>
            <span style={{ fontSize: '0.75rem', color: hoveredActivity.type === 'Run' ? '#ff3366' : '#06b6d4', fontWeight: 700 }}>
              {(hoveredActivity.distance / 1000).toFixed(1)} km
            </span>
            <span style={{ fontSize: '0.7rem', opacity: 0.65 }}>{formatPaceHeatmap(hoveredActivity)}</span>
            {hoveredActivity.elevation_gain > 0 && (
              <span style={{ fontSize: '0.7rem', opacity: 0.55 }}>↑{Math.round(hoveredActivity.elevation_gain)}m</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Heatmap;
