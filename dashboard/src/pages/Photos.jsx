import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Image as ImageIcon, Maximize2, X, Filter, MapPin, Calendar, Loader2, Play, Pause, ChevronLeft, ChevronRight, Globe } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

const Photos = ({ sportType }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  const [filterCountry, setFilterCountry] = useState('All');
  const [groupByMonth, setGroupByMonth] = useState(false);

  // Extract unique types and countries for filters
  const sportTypes = ['All', ...new Set(photos.map(p => p.type).filter(Boolean))];
  const countries = ['All', ...new Set(photos.map(p => {
    if (!p.country) return null;
    const parts = p.country.split(',');
    return parts[parts.length - 1].trim();
  }).filter(Boolean))];

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/v1/photos?sport_type=${sportType}`);
      setPhotos(res.data);
    } catch (err) {
      console.error("Failed to fetch photos", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setFilterType('All');
    setFilterCountry('All');
    setPhotos([]); // Clear old photos immediately to prevent 'ghosting'
    fetchPhotos();
  }, [sportType]);

  useEffect(() => {
    if (selectedPhoto) {
      document.body.classList.add('lightbox-open');
    } else {
      document.body.classList.remove('lightbox-open');
    }
    return () => document.body.classList.remove('lightbox-open');
  }, [selectedPhoto]);

  const filteredPhotos = photos.filter(p => {
    const typeMatch = filterType === 'All' || p.type === filterType;
    let countryMatch = filterCountry === 'All';
    if (filterCountry !== 'All' && p.country) {
        countryMatch = p.country.includes(filterCountry);
    }
    return typeMatch && countryMatch;
  });

  if (loading) {
    return (
      <div className="loader-screen" style={{ height: '400px', background: 'transparent' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <Loader2 color="var(--accent-cyan)" size={32} />
        </motion.div>
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
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '2rem' }}>
           <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              
              <div className="filter-group">
                 <label><Filter size={14} /> TYPE</label>
                 <select 
                   value={filterType} 
                   onChange={(e) => setFilterType(e.target.value)}
                   style={{ 
                     background: 'rgba(255, 255, 255, 0.05)', 
                     border: '1px solid rgba(255,255,255,0.1)', 
                     color: 'white', 
                     fontSize: '0.85rem', 
                     fontWeight: 600, 
                     outline: 'none', 
                     cursor: 'pointer',
                     borderRadius: '8px',
                     padding: '8px 12px',
                     minWidth: '130px'
                   }}
                 >
                   <option value="All">All Types</option>
                   {sportTypes.filter(t => t !== 'All').map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </div>

              <div className="filter-group">
                 <label><Globe size={14} /> COUNTRY</label>
                 <select 
                   value={filterCountry} 
                   onChange={(e) => setFilterCountry(e.target.value)}
                   style={{ 
                     background: 'rgba(255, 255, 255, 0.05)', 
                     border: '1px solid rgba(255,255,255,0.1)', 
                     color: 'white', 
                     fontSize: '0.85rem', 
                     fontWeight: 600, 
                     outline: 'none', 
                     cursor: 'pointer',
                     borderRadius: '8px',
                     padding: '8px 12px',
                     minWidth: '130px'
                   }}
                 >
                   <option value="All">All Countries</option>
                   {countries.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
              
              <div style={{ paddingBottom: '8px', fontSize: '0.8rem', fontWeight: 700, opacity: 0.8 }}>
                 {filteredPhotos.length} PHOTOS FOUND
              </div>
           </div>
           <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px' }}>
             {[{ key: false, label: 'GRID' }, { key: true, label: 'BY MONTH' }].map(opt => (
               <button key={String(opt.key)} onClick={() => setGroupByMonth(opt.key)} style={{
                 padding: '6px 14px', borderRadius: '7px', border: 'none', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
                 background: groupByMonth === opt.key ? 'var(--accent-cyan)' : 'transparent',
                 color: groupByMonth === opt.key ? '#000' : 'var(--text-secondary)', transition: 'all 0.2s'
               }}>{opt.label}</button>
             ))}
           </div>
        </div>

        {filteredPhotos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '6rem 2rem', opacity: 0.3 }}>
            <ImageIcon size={64} style={{ marginBottom: '1.5rem', strokeWidth: 1 }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>No photos matching filters</h3>
            <p style={{ fontSize: '0.9rem' }}>Try changing your filters or syncing more data.</p>
          </div>
        ) : groupByMonth ? (
          (() => {
            const grouped = filteredPhotos.reduce((acc, p) => {
              const key = p.date ? p.date.slice(0, 7) : 'Unknown';
              if (!acc[key]) acc[key] = [];
              acc[key].push(p);
              return acc;
            }, {});
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([month, monthPhotos]) => (
                  <div key={month}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.7, letterSpacing: '1px' }}>
                        {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.4, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>{monthPhotos.length}</span>
                    </div>
                    <div className="photos-masonry" style={{ columnGap: '1.5rem' }}>
                      {monthPhotos.map((photo) => (
                        <motion.div
                          key={photo.id}
                          whileHover={{ y: -6, scale: 1.02 }}
                          onClick={() => setSelectedPhoto(photo)}
                          style={{ breakInside: 'avoid', marginBottom: '1.5rem', borderRadius: '1.5rem', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--glass-border)' }}
                        >
                          <img src={photo.url.startsWith('http') ? photo.url : `${API_BASE}${photo.url}`} alt={photo.title}
                            style={{ width: '100%', display: 'block' }}
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=40'; }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          <div className="photos-masonry" style={{
            columnGap: '1.5rem',
            maxWidth: '100%',
            margin: '0'
          }}>
             {filteredPhotos.map((photo) => (
               <motion.div 
                 key={photo.id}
                 layoutId={photo.id}
                 whileHover={{ y: -8, scale: 1.02 }}
                 onClick={() => setSelectedPhoto(photo)}
                 style={{ 
                   breakInside: 'avoid', 
                   marginBottom: '1.5rem',
                   borderRadius: '1.5rem',
                   overflow: 'hidden',
                   cursor: 'pointer',
                   position: 'relative',
                   border: '1px solid var(--glass-border)',
                   background: 'var(--bg-card)',
                   boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                 }}
               >
                  <img 
                    src={photo.url.startsWith('http') ? photo.url : `${API_BASE}${photo.url}`} 
                    alt={photo.title} 
                    style={{ width: '100%', display: 'block', transition: 'filter 0.3s' }}
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=40';
                      e.target.style.opacity = '0.5';
                    }}
                  />
                  <div style={{ 
                    padding: '2rem 1rem 1rem', 
                    background: 'linear-gradient(to top, rgba(5,11,26,0.9) 0%, rgba(5,11,26,0.6) 50%, transparent 100%)',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    color: 'white',
                    opacity: 0,
                    transition: 'opacity 0.3s'
                  }} className="photo-info-overlay">
                     <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{photo.title}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                       <MapPin size={10} /> {photo.location}
                     </div>
                  </div>
                  <style>{`
                    .photo-info-overlay { transition: opacity 0.3s ease; }
                    div:hover > .photo-info-overlay { opacity: 1; }
                  `}</style>
               </motion.div>
             ))}
          </div>
        )}
      </div>

      {/* Lightbox Container */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ 
              position: 'fixed', 
              inset: 0, 
              zIndex: 3000, 
              background: 'rgba(2, 6, 23, 0.95)',
              backdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem'
            }}
          >
             {/* Controls Overlay */}
             <div style={{ position: 'absolute', top: '2rem', left: '2rem', right: '2rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', color: 'white', zIndex: 10 }}>
                <button 
                  onClick={() => setSelectedPhoto(null)} 
                  style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                   <X size={24} />
                </button>
             </div>

             <div style={{ position: 'relative', width: '100%', height: 'calc(100% - 40px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div 
                  key={selectedPhoto?.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{ maxWidth: '85vw', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
                >
                   <img 
                     src={(selectedPhoto?.url || '').startsWith('http') 
                        ? selectedPhoto.url 
                        : `${API_BASE}${selectedPhoto?.url}`} 
                     alt="" 
                     style={{ maxWidth: '100%', maxHeight: '68vh', borderRadius: '1.5rem', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)' }} 
                   />
                   <div style={{ marginTop: '2.5rem', color: 'white', paddingBottom: '2rem' }}>
                       <h3 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{selectedPhoto?.title}</h3>
                       <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginTop: '0.5rem', opacity: 0.6 }}>
                           <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={18} /> {selectedPhoto?.location}</span>
                           <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={18} /> {selectedPhoto?.date}</span>
                       </div>
                   </div>
                </motion.div>

                {/* Fixed Screen-Edge Navigation */}
                <button 
                  className="nav-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
                    setSelectedPhoto(filteredPhotos[(idx - 1 + filteredPhotos.length) % filteredPhotos.length]);
                  }}
                  style={{ left: '2rem', position: 'fixed' }}
                >
                  <ChevronLeft size={32} />
                </button>
                <button 
                  className="nav-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
                    setSelectedPhoto(filteredPhotos[(idx + 1) % filteredPhotos.length]);
                  }}
                  style={{ right: '2rem', position: 'fixed' }}
                >
                  <ChevronRight size={32} />
                </button>
             </div>
             
             <style>{`
               .nav-btn {
                 position: absolute;
                 top: 50%;
                 transform: translateY(-50%);
                 width: 64px;
                 height: 64px;
                 border-radius: 50%;
                 background: rgba(255,255,255,0.08);
                 border: 1px solid rgba(255,255,255,0.1);
                 color: white;
                 cursor: pointer;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 transition: all 0.3s;
                 z-index: 5;
               }
               .nav-btn:hover { background: rgba(255,255,255,0.15); transform: translateY(-50%) scale(1.1); }
             `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Photos;
