import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Calendar, Trophy, Zap, Map, Activity, 
  TrendingUp, Leaf, Star, Maximize2, Repeat, 
  MapPin, Image as ImageIcon, Footprints, Bike,
  ArrowRight, Shield, Award, Hash, BarChart3, PieChart,
  ChevronDown, MessageSquare, Heart, History
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  CartesianGrid, AreaChart, Area, PieChart as RePieChart, Pie, Cell,
  LineChart, Line, Legend
} from 'recharts';
import { MapContainer, TileLayer, Polyline, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_BASE = 'http://localhost:8000';

const MapController = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [30, 30], animate: true });
    }
  }, [points, map]);
  return null;
};

const Rewind = ({ stats: appStats }) => {
  const [rewindData, setRewindData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [targetYear, setTargetYear] = useState('ALL');
  const [compareYear, setCompareYear] = useState('');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showComparePicker, setShowComparePicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, [targetYear, compareYear]);

  const fetchData = () => {
    setLoading(true);
    const url = `${API_BASE}/api/v1/stats/rewind?year=${targetYear}${compareYear ? `&compare_year=${compareYear}` : ''}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setRewindData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Rewind fetch error:", err);
        setLoading(false);
      });
  };

  if (loading && !rewindData) return <div style={{ height: '60vh' }} />;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const item = {
    hidden: { y: 15, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  const COLORS = ['var(--accent-cyan)', 'var(--accent-blue)', 'var(--accent-violet)', '#10b981', '#f59e0b', '#ef4444'];

  const restPieData = [
    { name: 'Training Days', value: rewindData?.habit?.active_days || 0, color: 'var(--accent-cyan)' },
    { name: 'Rest Days', value: rewindData?.habit?.rest_days || 0, color: 'rgba(255,255,255,0.05)' }
  ];

  const StatBox = ({ label, value, unit, diff, icon: Icon, color }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.65rem', fontWeight: 800, opacity: 0.4, letterSpacing: '1px' }}>
        <Icon size={14} color={color || 'var(--accent-cyan)'} /> {label}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 900, color: color || 'white', display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{unit}</span>
      </div>
      {diff !== undefined && (
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: diff >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)} {unit}
        </div>
      )}
    </div>
  );

  const SectionTitle = ({ icon: Icon, title, rightContent }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0, letterSpacing: '0.5px' }}>
        <Icon size={16} color="var(--accent-cyan)" /> {title.toUpperCase()}
      </h3>
      {rightContent}
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="page-content" style={{ paddingBottom: '5rem' }}>
      
      {/* Filters Toolbar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', position: 'sticky', top: '5rem', zIndex: 5 }}>
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="platform-card"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', fontWeight: 700, border: '1px solid var(--glass-border)', background: 'rgba(10, 22, 40, 0.95)', cursor: 'pointer', borderRadius: '12px', color: 'white' }}
          >
            {targetYear} <ChevronDown size={14} />
          </button>
          <AnimatePresence>
            {showYearPicker && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: '#0a1628', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '8px', minWidth: '120px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
              >
                <div 
                   onClick={() => { setTargetYear('ALL'); setShowYearPicker(false); }}
                   style={{ padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', background: targetYear === 'ALL' ? 'var(--accent-cyan)' : 'transparent', color: targetYear === 'ALL' ? '#000' : 'white', fontWeight: 600 }}
                >
                  ALL
                </div>
                {rewindData?.available_years?.map(y => (
                  <div 
                    key={y} onClick={() => { setTargetYear(y); setShowYearPicker(false); }}
                    style={{ padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', background: targetYear === y ? 'var(--accent-cyan)' : 'transparent', color: targetYear === y ? '#000' : 'white', fontWeight: 600 }}
                  >
                    {y}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowComparePicker(!showComparePicker)}
            className="platform-card"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', fontWeight: 700, border: '1px solid var(--glass-border)', background: 'rgba(10, 22, 40, 0.95)', cursor: 'pointer', borderRadius: '12px', color: 'white' }}
          >
            {compareYear ? `vs ${compareYear}` : 'COMPARE'} <ChevronDown size={14} />
          </button>
          <AnimatePresence>
            {showComparePicker && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: '#0a1628', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '8px', minWidth: '120px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
              >
                <div 
                   onClick={() => { setCompareYear(''); setShowComparePicker(false); }}
                   style={{ padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', opacity: 0.5 }}
                >
                  CANCEL
                </div>
                {rewindData?.available_years?.filter(y => y !== targetYear).map(y => (
                  <div 
                    key={y} onClick={() => { setCompareYear(y); setShowComparePicker(false); }}
                    style={{ padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', background: compareYear === y ? 'var(--accent-blue)' : 'transparent', color: 'white', fontWeight: 600 }}
                  >
                    {y}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hero Achievement Plate */}
      <motion.div variants={item} className="platform-card" style={{ 
        padding: '3rem', marginBottom: '2.5rem', 
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.2)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', opacity: 0.05 }}><Star size={300} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
          <div>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-2px', margin: 0 }}>THE REWIND <span style={{ opacity: 0.3 }}>{targetYear}</span></h1>
            <p style={{ fontSize: '1rem', opacity: 0.5, fontWeight: 600 }}>ANNUAL PERFORMANCE & HABIT INSIGHTS</p>
          </div>
          <Award size={64} color="var(--accent-cyan)" style={{ opacity: 0.8 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2.5rem' }}>
          <StatBox label="DISTANCE" value={rewindData?.overall?.distance} unit="KM" diff={rewindData?.comparison?.dist_diff} icon={MapPin} />
          <StatBox label="TOTAL TIME" value={rewindData?.overall?.hours} unit="H" diff={rewindData?.comparison?.time_diff} icon={Clock} />
          <StatBox label="ELEVATION" value={rewindData?.overall?.elevation} unit="M" diff={rewindData?.comparison?.elev_diff} icon={TrendingUp} />
          <StatBox label="SESSIONS" value={rewindData?.overall?.count} unit="SESS" diff={rewindData?.comparison?.count_diff} icon={Activity} />
          <StatBox label="CALORIES" value={rewindData?.overall?.calories} unit="KCAL" diff={rewindData?.comparison?.cal_diff} icon={Zap} />
          <StatBox label="CARBON SAVED" value={rewindData?.carbon} unit="KG" diff={rewindData?.comparison?.carbon_diff} icon={Leaf} color="#10b981" />
        </div>
      </motion.div>

      {/* 2-Column Responsive Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: '2rem' }}>
        
        {/* Row 1: Gear (Bar/Pie) | Longest Activity (Map) */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <SectionTitle icon={Shield} title="GEAR UTILITY" />
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={rewindData?.gear} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" fontSize={11} width={120} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px' }} />
                <Bar dataKey="hours" fill="var(--accent-blue)" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={item} className="platform-card" style={{ padding: '0', overflow: 'hidden', position: 'relative', minHeight: '350px' }}>
          <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 500, background: 'rgba(10, 22, 40, 0.8)', padding: '12px 20px', borderRadius: '16px', backdropFilter: 'blur(8px)', border: '1px solid var(--glass-border)' }}>
             <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.5, marginBottom: '4px' }}>🏆 LONGEST ACTIVITY (H)</div>
             <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{rewindData?.longest?.name}</div>
             <div style={{ display: 'flex', gap: '15px', marginTop: '8px', fontSize: '0.8rem', opacity: 0.8 }}>
                <span>{rewindData?.longest?.dist_km} km</span>
                <span>{rewindData?.longest?.hours} h</span>
                <span>{rewindData?.longest?.date}</span>
             </div>
          </div>
          <MapContainer center={[30.27, 120.15]} zoom={11} style={{ height: '100%', width: '100%', background: '#050b1a', zIndex: 1 }} zoomControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {rewindData?.longest?.summary_polyline && (
              <>
                <Polyline positions={decodePolyline(rewindData.longest.summary_polyline)} pathOptions={{ color: 'var(--accent-cyan)', weight: 3, opacity: 0.8 }} />
                <MapController points={decodePolyline(rewindData.longest.summary_polyline)} />
              </>
            )}
          </MapContainer>
        </motion.div>

        {/* Row 2: Monthly PRs (Line) | Streaks (3 Boxes) */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <SectionTitle icon={Award} title="MONTHLY PRs" />
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={rewindData?.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px' }} />
                <Line type="monotone" dataKey="prs" stroke="var(--accent-cyan)" strokeWidth={3} dot={{ fill: 'var(--accent-cyan)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <SectionTitle icon={Zap} title="CONSECUTIVE RECORDS" rightContent={<div style={{fontSize: '0.65rem', fontWeight: 800, opacity: 0.4, letterSpacing: '0.5px'}}>{targetYear === 'ALL' ? 'ALL-TIME BEST' : `${targetYear} PERSPECTIVE`}</div>} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', height: '100%', alignItems: 'center' }}>
            {[
              { label: 'days', value: rewindData?.streaks?.day, sub: 'streak count' },
              { label: 'weeks', value: rewindData?.streaks?.week, sub: 'streak count' },
              { label: 'months', value: rewindData?.streaks?.month, sub: 'streak count' }
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: i === 0 ? 'var(--accent-cyan)' : i === 1 ? 'var(--accent-blue)' : 'var(--accent-violet)' }}>{s.value}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '5px' }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize: '0.6rem', opacity: 0.3, marginTop: '8px', textTransform: 'uppercase' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Row 3: Monthly Distance | Monthly Elevation */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <SectionTitle icon={MapPin} title="DISTANCE STATS (KM)" rightContent={<div style={{fontSize: '0.8rem', opacity: 0.5}}>{rewindData?.overall?.distance} km</div>} />
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={rewindData?.monthly}>
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px' }} />
                <Bar dataKey="dist" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <SectionTitle icon={TrendingUp} title="ELEVATION STATS (M)" rightContent={<div style={{fontSize: '0.8rem', opacity: 0.5}}>{rewindData?.overall?.elevation} m</div>} />
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={rewindData?.monthly}>
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px' }} />
                <Bar dataKey="elev" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Row 4: Total Time (Pie) | Carbon Reduction Number */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <SectionTitle icon={Clock} title="TOTAL TIME DISTRIBUTION" rightContent={<div style={{fontSize: '0.8rem', opacity: 0.5}}>{rewindData?.overall?.hours} hours</div>} />
          <div style={{ height: '240px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <ResponsiveContainer>
                <RePieChart>
                   <Pie data={rewindData?.monthly} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="time" labelLine={false}>
                      {rewindData?.monthly.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                   </Pie>
                   <Tooltip />
                </RePieChart>
             </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={item} className="platform-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
          <SectionTitle icon={Leaf} title="CARBON OFFSET" />
          <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
             <div style={{ fontSize: '4.5rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{rewindData?.carbon}</div>
             <div style={{ fontSize: '1.2rem', fontWeight: 700, opacity: 0.6, marginTop: '5px' }}>kg CO₂</div>
             <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem' }}>
                <div>
                   <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>0</div>
                   <div style={{ fontSize: '0.6rem', opacity: 0.4, textTransform: 'uppercase' }}>PASSED CARS</div>
                </div>
                <div>
                   <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>0</div>
                   <div style={{ fontSize: '0.6rem', opacity: 0.4, textTransform: 'uppercase' }}>GOOGLE SEARCHES</div>
                </div>
             </div>
          </div>
        </motion.div>

        {/* Row 5: Rest Days (Pie) | Start Time (Area) */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <SectionTitle icon={PieChart} title="REST DAYS BALANCE" rightContent={<div style={{fontSize: '0.8rem', opacity: 0.5}}>{Math.round(rewindData?.habit?.rest_days / rewindData?.habit?.total_days * 100)}%</div>} />
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', height: '240px' }}>
            <div style={{ height: '100%', width: '200px' }}>
              <ResponsiveContainer>
                <RePieChart>
                  <Pie data={restPieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {restPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{opacity: 0.5, fontSize: '0.8rem'}}>Training Days</span>
                  <span style={{fontWeight: 800}}>{rewindData?.habit?.active_days} d</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{opacity: 0.5, fontSize: '0.8rem'}}>Rest Days</span>
                  <span style={{fontWeight: 800}}>{rewindData?.habit?.rest_days} d</span>
               </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
          <SectionTitle icon={Clock} title="START TIME PREFERENCE" />
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={rewindData?.time_of_day}>
                <defs>
                  <linearGradient id="pTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="rgba(255,255,255,0.2)" fontSize={10} interval={3} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="count" stroke="var(--accent-cyan)" fill="url(#pTime)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Row 6: Activity Volume | Activity Locations */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
           <SectionTitle icon={History} title="ACTIVITY VOLUME" rightContent={<div style={{fontSize: '0.8rem', opacity: 0.5}}>{rewindData?.overall?.count} activities</div>} />
           <div style={{ height: '240px', width: '100%' }}>
             <ResponsiveContainer>
               <BarChart data={rewindData?.monthly}>
                 <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={11} axisLine={false} tickLine={false} />
                 <YAxis hide />
                 <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '12px' }} />
                 <Bar dataKey="count" fill="var(--accent-violet)" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </motion.div>

        <motion.div variants={item} className="platform-card" style={{ padding: '2rem' }}>
           <SectionTitle icon={Map} title="ACTIVITY LOCATIONS" />
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div style={{ height: '240px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)', margin: '0 auto' }}></div>
                    <div style={{ marginTop: '10px', fontSize: '0.9rem', fontWeight: 800 }}>{rewindData?.locations[0]?.location_city || 'UNKNOWN'}</div>
                 </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                 {rewindData?.locations?.slice(0, 5).map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                       <span style={{ opacity: 0.5 }}>{l.location_city}</span>
                       <span style={{ fontWeight: 700 }}>{l.count} sess</span>
                    </div>
                 ))}
              </div>
           </div>
        </motion.div>

        {/* Row 7: Photos - Dynamic integration */}
        <motion.div variants={item} className="platform-card" style={{ padding: '2rem', gridColumn: 'span 2' }}>
           <SectionTitle icon={ImageIcon} title="PHOTOS" />
           {rewindData?.photos?.length > 0 ? (
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem' }}>
                {rewindData.photos.map((photo) => (
                  <div key={photo.id} style={{ height: '220px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', position: 'relative' }}>
                     <img 
                       src={photo.url.startsWith('http') ? photo.url : `${API_BASE}${photo.url}`} 
                       alt={photo.title} 
                       style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                       onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400'; }}
                     />
                     <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '15px 10px 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', fontSize: '0.65rem', fontWeight: 700 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{photo.title}</div>
                        <div style={{ opacity: 0.6, fontSize: '0.6rem', marginTop: '4px' }}>{photo.date}</div>
                     </div>
                  </div>
                ))}
             </div>
           ) : (
             <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3, border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '20px' }}>
                <ImageIcon size={48} style={{ marginBottom: '1rem' }} />
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>No photos synced for {targetYear}</div>
             </div>
           )}
        </motion.div>
      </div>

    </motion.div>
  );
};

// Polyline decoder helper
function decodePolyline(str, precision = 5) {
  if (!str) return [];
  let index = 0, lat = 0, lng = 0, points = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
  while (index < str.length) {
    byte = null; shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += latitude_change; lng += longitude_change;
    points.push([lat / factor, lng / factor]);
  }
  return points;
}

export default Rewind;
