import { Settings, Bell, Search, Github, Bike, Footprints, Menu, X } from 'lucide-react';
import { motion } from 'framer-motion';

const Header = ({ title, icon: Icon, profile, sportType, setSportType, setIsMobileMenuOpen, isMobileMenuOpen }) => {
  return (
    <header className="main-header">
      <div 
        className={`menu-toggle-btn mobile-only ${isMobileMenuOpen ? 'active' : ''}`} 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        style={{ zIndex: 2500, position: 'relative' }}
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </div>
      <div className="page-title-hub desktop-only">
        {Icon && <Icon size={20} color="var(--accent-cyan)" />}
        <h1>{title}</h1>
      </div>

      <div className="action-hub">
        {/* Sport Switcher "Floating Island" */}
        <div className="sport-switcher-island" style={{ 
          background: 'rgba(255, 255, 255, 0.05)', 
          padding: '4px', 
          borderRadius: '12px', 
          display: 'flex', 
          gap: '4px',
          marginRight: '15px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSportType('Ride')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              background: sportType === 'Ride' ? 'var(--accent-cyan)' : 'transparent',
              color: sportType === 'Ride' ? '#000' : 'rgba(255, 255, 255, 0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.7rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <Bike size={14} /> RIDE
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSportType('Run')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              background: sportType === 'Run' ? '#ff3366' : 'transparent',
              color: sportType === 'Run' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.7rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <Footprints size={14} /> RUN
          </motion.button>
        </div>

        <a 
          href="https://github.com/TrojanFish/TrackRecord" 
          target="_blank" 
          rel="noopener noreferrer"
          className="icon-btn desktop-only" 
          title="GitHub Repository" 
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit', textDecoration: 'none' }}
        >
            <Github size={18} />
        </a>
        <button className="icon-btn desktop-only" title="Search" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'transparent', border: 'none' }}>
            <Search size={18} />
        </button>
        <button className="icon-btn desktop-only" title="Notifications" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'transparent', border: 'none' }}>
            <Bell size={18} />
            <span className="notification-dot" style={{ top: '8px', right: '8px', width: '6px', height: '6px' }} />
        </button>
        <button className="icon-btn desktop-only" title="Settings" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'transparent', border: 'none' }}>
            <Settings size={18} />
        </button>
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
        <div className="user-profile">
            <div className="avatar" title={profile?.username || 'User'} style={{ width: '32px', height: '32px', borderRadius: '10px', fontSize: '0.7rem' }}>
              {profile?.profile ? (
                <img src={profile.profile} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
              ) : (
                profile?.username ? profile.username.substring(0, 2).toUpperCase() : 'KY'
              )}
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
