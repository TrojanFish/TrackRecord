import React from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Trophy, Calendar, Loader2, RefreshCw, X, ChevronRight, HelpCircle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

const Challenges = () => {
  const [challenges, setChallenges] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [pasteHtml, setPasteHtml] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState('');
  const [importSuccess, setImportSuccess] = React.useState('');

  React.useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/challenges`);
      setChallenges(res.data);
    } catch (err) {
      console.error("Failed to fetch challenges", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!pasteHtml.trim()) return;
    setImporting(true);
    setImportError('');
    setImportSuccess('');
    try {
      const res = await axios.post(`${API_BASE}/api/v1/challenges/import`, { html: pasteHtml });
      const count = res.data?.count || 0;
      setImportSuccess(`${count} trophy${count !== 1 ? 'ies' : 'y'} imported successfully!`);
      setPasteHtml('');
      fetchChallenges();
      setTimeout(() => { setIsImportModalOpen(false); setImportSuccess(''); }, 2000);
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to parse trophies.";
      setImportError(detail + " Make sure you pasted the full page source from Strava's Trophy Case.");
    } finally {
      setImporting(false);
    }
  };

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
      className="page-content"
    >
      <div className="platform-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <style>{`
          .sync-btn:hover { background: rgba(6, 182, 212, 0.2); transform: translateY(-2px); }
          .spinning { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>

        {/* Header row: total count + import button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>
            {challenges.reduce((s, g) => s + g.items.length, 0)} TOTAL TROPHIES &amp; CLUBS
          </div>
          <button
            onClick={() => { setImportError(''); setImportSuccess(''); setIsImportModalOpen(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)',
              color: 'var(--accent-cyan)', padding: '10px 16px', borderRadius: '12px',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s'
            }}
            className="sync-btn"
          >
            <RefreshCw size={16} /> IMPORT TROPHIES
          </button>
        </div>

        {/* Empty state */}
        {challenges.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.4 }}>
            <Trophy size={64} style={{ marginBottom: '1.5rem', strokeWidth: 1 }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>No trophies yet</h3>
            <p style={{ fontSize: '0.9rem' }}>Import your Strava Trophy Case to see your achievements here.</p>
          </div>
        )}

        {challenges.map((section, idx) => (
          <div key={idx} style={{ marginBottom: '3rem' }}>
             <div style={{ 
               display: 'flex', 
               justifyContent: 'space-between', 
               alignItems: 'center', 
               marginBottom: '1.5rem' 
             }}>
                <h3 style={{ 
                  fontSize: '1rem', 
                  fontWeight: 700, 
                  color: 'var(--text-secondary)', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  margin: 0
                }}>
                  <Calendar size={16} /> {section.month.toUpperCase()} 
                  <span style={{ fontSize: '0.8rem', opacity: 0.4, fontWeight: 500 }}>({section.items.length})</span>
                </h3>

                <span style={{ fontSize: '0.7rem', opacity: 0.4, fontWeight: 700 }}>{section.items.length} items</span>
             </div>
             
             <div className="challenge-grid">
                {section.items.map(item => (
                  <motion.div 
                    key={item.id}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      cursor: 'pointer' 
                    }}
                  >
                    <div style={{ 
                      width: '80px', 
                      height: '80px', 
                      borderRadius: '50%', 
                      background: item.image ? 'none' : `linear-gradient(135deg, ${item.color}33, ${item.color}66)`,
                      border: `2px solid ${item.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      marginBottom: '0.75rem',
                      boxShadow: `0 10px 20px ${item.color}22`,
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                       {item.image ? (
                         <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                       ) : item.icon}
                       {item.progress && (
                         <div style={{
                           position: 'absolute',
                           bottom: '0',
                           padding: '2px 8px',
                           background: item.color,
                           color: 'white',
                           fontSize: '0.6rem',
                           borderRadius: '0',
                           fontWeight: 900,
                           width: '100%',
                           textAlign: 'center',
                           opacity: 0.9
                         }}>
                           {item.progress}
                         </div>
                       )}
                    </div>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      fontWeight: 600, 
                      textAlign: 'center',
                      maxWidth: '100px',
                      lineHeight: 1.2,
                      opacity: 0.8
                    }}>
                      {item.name}
                    </span>
                  </motion.div>
                ))}
             </div>
          </div>
        ))}
      </div>

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ 
              position: 'fixed', inset: 0, zIndex: 1000, 
              background: 'rgba(5, 11, 26, 0.9)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
            }}
            onClick={() => setIsImportModalOpen(false)}
          >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.9, y: 20 }}
               className="platform-card"
               style={{ 
                 width: '100%', maxWidth: '600px', padding: '2rem', 
                 maxHeight: '80vh', display: 'flex', flexDirection: 'column' 
               }}
               onClick={e => e.stopPropagation()}
             >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                   <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={20} /> SYNC TROPHY CASE
                   </h3>
                   <button onClick={() => setIsImportModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', opacity: 0.5, cursor: 'pointer' }}>
                      <X size={24} />
                   </button>
                </div>

                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '1rem', 
                  borderRadius: '12px', 
                  fontSize: '0.8rem', 
                  lineHeight: '1.5', 
                  marginBottom: '1.5rem',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', marginBottom: '8px', fontWeight: 700 }}>
                      <HelpCircle size={14} /> HOW TO SYNC?
                   </div>
                   <ol style={{ paddingLeft: '1.2rem', opacity: 0.7 }}>
                      <li>Go to your Strava <b style={{color:'white'}}>Trophy Case</b> page in browser.</li>
                      <li>Right-click anywhere and select <b style={{color:'white'}}>"View Page Source"</b>.</li>
                      <li>Select All <b style={{color:'white'}}>(Ctrl+A)</b> and Copy <b style={{color:'white'}}>(Ctrl+C)</b>.</li>
                      <li>Paste the code below and hit Import.</li>
                   </ol>
                </div>

                <textarea 
                  value={pasteHtml}
                  onChange={e => setPasteHtml(e.target.value)}
                  placeholder="Paste Strava source code here..."
                  style={{ 
                    flex: 1, 
                    minHeight: '200px', 
                    background: 'rgba(0,0,0,0.3)', 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: '12px', 
                    padding: '1rem', 
                    color: 'white', 
                    fontSize: '0.8rem', 
                    fontFamily: 'monospace',
                    outline: 'none',
                    resize: 'none'
                  }}
                />

                {importError && (
                  <div style={{ marginTop: '1rem', padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', fontSize: '0.8rem', color: '#ef4444' }}>
                    {importError}
                  </div>
                )}
                {importSuccess && (
                  <div style={{ marginTop: '1rem', padding: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                    ✓ {importSuccess}
                  </div>
                )}

                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                   <button 
                     onClick={() => setIsImportModalOpen(false)}
                     style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                   >
                     CANCEL
                   </button>
                   <button 
                     onClick={handleImport}
                     disabled={importing || !pasteHtml.trim()}
                     style={{ 
                       flex: 2, padding: '12px', borderRadius: '12px', 
                       background: 'var(--accent-cyan)', 
                       border: 'none', color: 'black', fontWeight: 900, 
                       cursor: (importing || !pasteHtml.trim()) ? 'not-allowed' : 'pointer',
                       opacity: (importing || !pasteHtml.trim()) ? 0.5 : 1
                     }}
                   >
                     {importing ? 'PARSING...' : 'IMPORT TROPHIES'}
                   </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Challenges;
