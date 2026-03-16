import React from 'react';
import { Github, Settings, Bell, Search } from 'lucide-react';

const Header = ({ title, profile }) => {
  return (
    <header className="main-header">
      <div className="header-left">
        <h1 className="page-title">{title}</h1>
      </div>
      
      <div className="header-right">
        <button className="icon-btn" title="Notifications">
            <Bell size={20} />
            <span className="notification-dot" />
        </button>
        <button className="icon-btn" title="Settings">
            <Settings size={20} />
        </button>
        <div className="user-profile">
            <div className="avatar" title={profile?.username || 'User'}>
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
