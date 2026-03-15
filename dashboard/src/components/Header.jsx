import React from 'react';
import { Github, Settings, Bell, Search } from 'lucide-react';

const Header = ({ title }) => {
  return (
    <header className="main-header">
      <div className="header-left">
        <h1 className="page-title">{title}</h1>
      </div>
      
      <div className="header-center">
        <div className="search-bar">
          <Search size={16} />
          <input type="text" placeholder="Search activities, segments, gear..." />
        </div>
      </div>

      <div className="header-right">
        <button className="icon-btn" title="Notifications">
            <Bell size={20} />
            <span className="notification-dot" />
        </button>
        <button className="icon-btn" title="Settings">
            <Settings size={20} />
        </button>
        <a href="https://github.com/yihong0618/running_page" target="_blank" rel="noreferrer" className="github-link">
          <Github size={20} />
          <span>GITHB</span>
        </a>
        <div className="user-profile">
            <div className="avatar">KY</div>
        </div>
      </div>
    </header>
  );
};

export default Header;
