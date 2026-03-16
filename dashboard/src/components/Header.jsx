import { Settings, Bell, Search, Github } from 'lucide-react';

const Header = ({ title, icon: Icon, profile }) => {
  return (
    <header className="main-header">
      <div className="page-title-hub">
        {Icon && <Icon size={20} color="var(--accent-cyan)" />}
        <h1>{title}</h1>
      </div>

      <div className="action-hub">
        <a 
          href="https://github.com/TrojanFish/TrackRecord" 
          target="_blank" 
          rel="noopener noreferrer"
          className="icon-btn" 
          title="GitHub Repository" 
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit', textDecoration: 'none' }}
        >
            <Github size={18} />
        </a>
        <button className="icon-btn" title="Search" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'transparent', border: 'none' }}>
            <Search size={18} />
        </button>
        <button className="icon-btn" title="Notifications" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'transparent', border: 'none' }}>
            <Bell size={18} />
            <span className="notification-dot" style={{ top: '8px', right: '8px', width: '6px', height: '6px' }} />
        </button>
        <button className="icon-btn" title="Settings" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'transparent', border: 'none' }}>
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
