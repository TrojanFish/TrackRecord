import React from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  Map as MapIcon, 
  Calendar, 
  Layers, 
  Trophy, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  History,
  Settings
} from 'lucide-react';
import { motion } from 'framer-motion';

const Sidebar = ({ activeTab, setActiveTab, isExpanded, setIsExpanded, stats }) => {
  const getBadgeValue = (id) => {
    if (!stats) return null;
    if (id === 'Activities') return stats.total_count;
    if (id === 'Eddington') {
      const runE = stats.eddington?.Run?.value || 0;
      const rideE = stats.eddington?.Ride?.value || 0;
      return Math.max(runE, rideE);
    }
    if (id === 'Challenges') return stats.challenges_count;
    if (id === 'Photos') return stats.photos_count;
    if (id === 'Gear') return stats.gear_count;
    return null;
  };

  const groups = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'Overview', icon: LayoutDashboard, label: 'DASHBOARD' },
        { id: 'Activities', icon: Activity, label: 'ACTIVITIES' },
      ]
    },
    {
      title: 'STATISTICS',
      items: [
        { id: 'Stats', icon: Calendar, label: 'MONTHLY STATS' },
        { id: 'Analytics', icon: TrendingUp, label: 'ANALYTICS' },
        { id: 'Eddington', icon: Trophy, label: 'EDDINGTON' },
        { id: 'Heatmap', icon: MapIcon, label: 'HEATMAP' },
        { id: 'Records', icon: History, label: 'BEST EFFORTS' },
      ]
    },
    {
      title: 'SOCIAL & MORE',
      items: [
        { id: 'Challenges', icon: Trophy, label: 'CHALLENGES' },
        { id: 'Photos', icon: Layers, label: 'PHOTOS' },
        { id: 'Gear', icon: Layers, label: 'GEAR' },
      ]
    }
  ];

  return (
    <motion.div 
      className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}
      animate={{ width: isExpanded ? 260 : 80 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div className="sidebar-header">
        <button className="collapse-btn-top" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
        <div className="logo-container">
          <div className="logo-icon">TR</div>
          {isExpanded && <span className="logo-text">TRACKRECORD</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {groups.map((group, idx) => (
          <div key={idx} className="nav-group">
            {isExpanded && <div className="nav-group-title">{group.title}</div>}
            <div className="nav-group-items">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  title={!isExpanded ? item.label : ''}
                >
                  <item.icon size={20} />
                  {isExpanded && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center', marginLeft: '12px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.label}</span>
                      {getBadgeValue(item.id) !== null && getBadgeValue(item.id) > 0 && (
                        <span className="nav-badge">{getBadgeValue(item.id)}</span>
                      )}
                    </div>
                  )}
                  {activeTab === item.id && (
                    <motion.div layoutId="nav-active" className="nav-active-indicator" />
                  )}
                </button>
              ))}
            </div>
            {isExpanded && idx < groups.length - 1 && <div className="nav-divider" />}
          </div>
        ))}
      </nav>
    </motion.div>
  );
};

export default Sidebar;
