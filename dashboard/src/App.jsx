import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Activity, Map, Calendar, 
  TrendingUp, Star, Award, History, Medal, 
  Image, Wrench, Milestone 
} from 'lucide-react';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Pages
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Eddington from './pages/Eddington';
import Activities from './pages/Activities';
import Heatmap from './pages/Heatmap';
import Records from './pages/Records';
import Gear from './pages/Gear';
import MonthlyStats from './pages/MonthlyStats';
import Challenges from './pages/Challenges';
import Photos from './pages/Photos';
import Rewind from './pages/Rewind';
import Segments from './pages/Segments';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

function App() {
  const [stats, setStats] = useState({ 
    total_distance: 0, total_count: 0, recent_activities: [], 
    heatmap: {}, yearly: {}, monthly_trends: [], breakdown: {},
    eddington: { Run: 0, Ride: 0 }, yoy_cumulative: [], available_years: [],
    weekly_trends: [], records: {}, time_preference: [],
    weekday_preference: [], gear_stats: [], training_load: [],
    records_trends: {}, daily_stats: [],
    recent_form: { this_week: { distance: 0, stress: 0, count: 0 }, last_week: { distance: 0, stress: 0, count: 0 } },
    athlete_metrics: { vo2_estimate: 0, zones: {}, max_hr: 0, resting_hr: 0 },
    athlete_profile: null,
    athlete_radar: [],
    dashboard_records: [],
    activity_pattern: []
  });
  const [activeTab, setActiveTab] = useState('Overview');
  const [sportType, setSportType] = useState('Ride'); 
  const [initialSearch, setInitialSearch] = useState('');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync with sportType change
  useEffect(() => { 
    fetchStats(); 
  }, [sportType]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/v1/stats?sport_type=${sportType}`);
      setStats(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch stats", err);
      setLoading(false);
    }
  };


  const renderHeatmap = (activeMetric = 'count') => {
    const days = [];
    const today = new Date();
    
    // Calculate max value for the active metric to determine levels
    const values = Object.values(stats.heatmap || {}).map(d => d[activeMetric] || 0);
    const maxVal = Math.max(...values, 1);
    
    const getMetricLevel = (val) => {
        if (!val) return '';
        if (activeMetric === 'count') {
            if (val >= 4) return 'level-4';
            if (val >= 3) return 'level-3';
            if (val >= 2) return 'level-2';
            return 'level-1';
        }
        // For other metrics, use quartiles
        const p = val / maxVal;
        if (p > 0.75) return 'level-4';
        if (p > 0.5) return 'level-3';
        if (p > 0.25) return 'level-2';
        return 'level-1';
    };

    const unitMap = { count: 'activities', dist: 'KM', time: 'h', elev: 'm', cal: 'kcal' };

    const monthLabels = [];
    let lastMonth = -1;

    // Start from Sunday 52 weeks ago to align the grid perfectly
    const daysToShow = 364 + today.getDay(); 

    for (let i = daysToShow; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const data = stats.heatmap[dateStr] || { count: 0, dist: 0, time: 0, elev: 0, cal: 0 };
      const val = data[activeMetric] || 0;
      
      // Calculate month labels for top row
      if (date.getDay() === 0) { // Start of a week (column)
        const currentMonth = date.getMonth();
        const weekColIndex = Math.floor((daysToShow - i) / 7);
        
        if (currentMonth !== lastMonth) {
          monthLabels.push(
            <div key={dateStr} style={{ 
              position: 'absolute',
              left: `${weekColIndex * (100 / 53)}%`,
              fontSize: '0.65rem', 
              opacity: 0.5, 
              fontWeight: 800,
              textAlign: 'left',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              transform: 'translateY(-2px)'
            }}>
              {date.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
            </div>
          );
          lastMonth = currentMonth;
        }
      }

      days.push(
        <div 
            key={dateStr} 
            className={`heatmap-day ${getMetricLevel(val)}`} 
            title={`${dateStr}: ${val}${unitMap[activeMetric]} (${data.count} activities)`} 
        />
      );
    }

    return (
        <div className="heatmap-scroll-island glass-scroll">
            <div className="heatmap-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', minWidth: '850px' }}>
                {/* Week Labels Column (Fixed relative to grid) */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateRows: '22px repeat(7, 12px)', 
                    gap: '2px',
                    fontSize: '0.6rem', 
                    opacity: 0.3,
                    fontWeight: 800,
                    marginTop: '2px',
                    textAlign: 'right',
                    width: '32px',
                    flexShrink: 0
                }}>
                    <div style={{ height: '22px' }}></div>
                    <div>SUN</div>
                    <div>MON</div>
                    <div>TUE</div>
                    <div>WED</div>
                    <div>THU</div>
                    <div>FRI</div>
                    <div>SAT</div>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                    {/* Month Labels Row - Using absolute positioning for better overflow handling */}
                    <div style={{ 
                        position: 'relative',
                        height: '22px',
                        width: '100%',
                        marginBottom: '4px'
                    }}>
                        {monthLabels}
                    </div>
                    {/* Heatmap Grid */}
                    <div className="heatmap-container" style={{ 
                        gridTemplateColumns: 'repeat(53, 1fr)',
                        gridTemplateRows: 'repeat(7, 12px)',
                        gap: '2px'
                    }}>
                        {days}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  if (loading) {
    return (
      <div className="loader-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <Activity color="var(--accent-cyan)" size={48} />
        </motion.div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview': return <Dashboard stats={stats} setActiveTab={setActiveTab} renderHeatmap={renderHeatmap} setInitialSearch={setInitialSearch} />;
      case 'Activities': return <Activities stats={stats} setActiveTab={setActiveTab} initialSearch={initialSearch} onSearchClear={() => setInitialSearch('')} sportType={sportType} />;
      case 'Analytics': return <Analytics stats={stats} sportType={sportType} />;
      case 'Eddington': return <Eddington stats={stats} sportType={sportType} />;
      case 'Heatmap': return <Heatmap activities={stats.recent_activities} availableYears={stats.available_years} sportType={sportType} />;
      case 'Records': return <Records stats={stats} setActiveTab={setActiveTab} setInitialSearch={setInitialSearch} sportType={sportType} />;
      case 'Gear': return <Gear stats={stats} sportType={sportType} />;
      case 'Stats': return <MonthlyStats stats={stats} renderHeatmap={renderHeatmap} sportType={sportType} />;
      case 'Challenges': return <Challenges />;
      case 'Photos': return <Photos sportType={sportType} />;
      case 'Rewind': return <Rewind stats={stats} sportType={sportType} />;
      case 'Segments': return <Segments sportType={sportType} />;
      default: return <Dashboard stats={stats} setActiveTab={setActiveTab} />;
    }
  };

  const tabMetadata = {
    'Overview': { title: 'DASHBOARD', icon: LayoutDashboard },
    'Activities': { title: 'ACTIVITY CENTER', icon: Activity },
    'Stats': { title: 'MONTHLY STATS', icon: Calendar },
    'Analytics': { title: 'PERFORMANCE ANALYTICS', icon: TrendingUp },
    'Rewind': { title: 'ANNUAL REWIND', icon: Star },
    'Eddington': { title: 'EDDINGTON SCORE', icon: Award },
    'Heatmap': { title: 'GLOBAL HEATMAP', icon: Map },
    'Records': { title: 'PERSONAL RECORDS', icon: History },
    'Challenges': { title: 'STRAVA CHALLENGES', icon: Medal },
    'Photos': { title: 'ACTIVITY GALLERY', icon: Image },
    'Segments': { title: 'SEGMENTS PERFORMANCE', icon: Milestone },
    'Gear': { title: 'EQUIPMENT TRACKING', icon: Wrench }
  };

  const currentTabInfo = tabMetadata[activeTab] || { title: activeTab.toUpperCase(), icon: null };

  return (
    <div className={`app-container sport-${sportType.toLowerCase()}`}>
      <div className="dynamic-bg">
        <div className="bg-blob blob-1"></div>
        <div className="bg-blob blob-2"></div>
        <div className="bg-blob blob-3"></div>
      </div>
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false); // Close menu on tab selection
        }} 
        isExpanded={isSidebarExpanded} 
        setIsExpanded={setIsSidebarExpanded}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        stats={stats}
      />

      <main className="main-content">
        <Header 
          title={currentTabInfo.title} 
          icon={currentTabInfo.icon}
          profile={stats.athlete_profile} 
          sportType={sportType}
          setSportType={setSportType}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        <AnimatePresence mode="wait">
          {renderTabContent()}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
