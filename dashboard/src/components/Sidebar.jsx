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
  Settings,
  Star,
  Award,
  Medal,
  Image,
  Wrench
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
        { id: 'Rewind', icon: Star, label: 'REWIND' },
        { id: 'Eddington', icon: Award, label: 'EDDINGTON' },
        { id: 'Heatmap', icon: MapIcon, label: 'HEATMAP' },
        { id: 'Records', icon: History, label: 'BEST EFFORTS' },
      ]
    },
    {
      title: 'SOCIAL & MORE',
      items: [
        { id: 'Challenges', icon: Medal, label: 'CHALLENGES' },
        { id: 'Photos', icon: Image, label: 'PHOTOS' },
        { id: 'Gear', icon: Wrench, label: 'GEAR' },
      ]
    }
  ];

  return (
    <motion.div 
      className={`sidebar ${isExpanded ? 'expanded sidebar-expanded' : 'collapsed'}`}
      animate={{ width: isExpanded ? 240 : 72 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <button className="edge-handle-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      <div className="sidebar-header" style={{ borderBottom: 'none' }}>
        <div className="logo-container">
          <div className="logo-icon" style={{ width: '32px', height: '32px', fontSize: '0.9rem', fontWeight: 900 }}>TR</div>
          {isExpanded && <span className="logo-text" style={{ fontSize: '0.8rem', fontWeight: 900 }}>TRACKRECORD</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {groups.map((group, idx) => (
          <div key={idx} className="nav-group">
            {isExpanded && <div className="nav-group-title" style={{ opacity: 0.15, fontSize: '0.55rem' }}>{group.title}</div>}
            <div className="nav-group-items">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  title={!isExpanded ? item.label : ''}
                  style={{ borderRadius: '14px', margin: '4px 8px' }}
                >
                  <item.icon size={18} />
                  {isExpanded && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center', marginLeft: '10px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.3px' }}>{item.label}</span>
                      {getBadgeValue(item.id) !== null && getBadgeValue(item.id) > 0 && (
                        <span className="nav-badge" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>{getBadgeValue(item.id)}</span>
                      )}
                    </div>
                  )}
                  {activeTab === item.id && (
                    <motion.div layoutId="nav-active" className="nav-active-indicator" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </motion.div>
  );
};

export default Sidebar;
