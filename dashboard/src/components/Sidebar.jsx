import React from 'react';
import { 
  X,
  LayoutDashboard, 
  Activity, 
  Map as MapIcon, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  History,
  Star,
  Award,
  Medal,
  Image,
  Wrench,
  Milestone as RouteIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ activeTab, setActiveTab, isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen, stats }) => {
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
      title: 'REAL-TIME',
      items: [
        { id: 'Overview', icon: LayoutDashboard, label: 'DASHBOARD' },
        { id: 'Activities', icon: Activity, label: 'ACTIVITIES' },
        { id: 'Heatmap', icon: MapIcon, label: 'HEATMAP' },
      ]
    },
    {
      title: 'PERIODIC',
      items: [
        { id: 'Stats', icon: Calendar, label: 'MONTHLY STATS' },
        { id: 'Analytics', icon: TrendingUp, label: 'ANALYTICS' },
        { id: 'Rewind', icon: Star, label: 'REWIND' },
      ]
    },
    {
      title: 'HALL OF FAME',
      items: [
        { id: 'Records', icon: History, label: 'BEST EFFORTS' },
        { id: 'Eddington', icon: Award, label: 'EDDINGTON' },
        { id: 'Segments', icon: RouteIcon, label: 'SEGMENTS' },
        { id: 'Challenges', icon: Medal, label: 'CHALLENGES' },
      ]
    },
    {
      title: 'RESOURCES',
      items: [
        { id: 'Photos', icon: Image, label: 'PHOTOS' },
        { id: 'Gear', icon: Wrench, label: 'GEAR' },
      ]
    }
  ];

  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' && window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="sidebar-overlay"
          />
        )}
      </AnimatePresence>

      <motion.div 
        className={`sidebar ${((isExpanded || isMobile) ? 'expanded' : 'collapsed')} ${isMobileOpen ? 'mobile-open' : ''} ${isMobile ? 'is-mobile' : ''}`}
        animate={isMobile 
          ? { x: isMobileOpen ? 0 : '-110%' } 
          : { width: isExpanded ? 240 : 72, x: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {!isMobile && (
          <button className="edge-handle-toggle" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">TR</div>
            {(isExpanded || isMobile) && <span className="logo-text">TRACKRECORD</span>}
          </div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group, idx) => (
            <div key={idx} className="nav-group">
              {(isExpanded || isMobile) && (
                <div className="nav-group-title">{group.title}</div>
              )}
              <div className="nav-group-items">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <item.icon size={18} />
                    {(isExpanded || isMobile) && (
                      <div className="nav-item-label-container">
                        <span className="nav-label">{item.label}</span>
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
            </div>
          ))}
        </nav>
      </motion.div>
    </>
  );
};

export default Sidebar;
