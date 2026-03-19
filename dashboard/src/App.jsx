import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Activity, Map, Calendar, 
  TrendingUp, Star, Award, History, Medal, 
  Image, Wrench, Milestone 
} from 'lucide-react';

// Components (eagerly loaded — always visible)
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// ─── ARCH-2: Lazy-load all page components ────────────────────────────────────
// Each page is split into its own JS chunk and only downloaded when first visited.
const Dashboard   = lazy(() => import('./pages/Dashboard'));
const Analytics   = lazy(() => import('./pages/Analytics'));
const Eddington   = lazy(() => import('./pages/Eddington'));
const Activities  = lazy(() => import('./pages/Activities'));
const Heatmap     = lazy(() => import('./pages/Heatmap'));
const Records     = lazy(() => import('./pages/Records'));
const Gear        = lazy(() => import('./pages/Gear'));
const MonthlyStats = lazy(() => import('./pages/MonthlyStats'));
const Challenges  = lazy(() => import('./pages/Challenges'));
const Photos      = lazy(() => import('./pages/Photos'));
const Rewind      = lazy(() => import('./pages/Rewind'));
const Segments    = lazy(() => import('./pages/Segments'));
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

// Reusable tab-switch loading indicator (lightweight, no extra deps)
const TabLoader = () => (
  <div style={{ 
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '300px', opacity: 0.4 
  }}>
    <div className="loader-pulse" style={{ width: 40, height: 40 }} />
  </div>
);

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

  // ─── PERF-3: AbortController ref persists across renders ─────────────────────
  const abortControllerRef = useRef(null);

  // ─── PERF-3: Debounced fetch — fires 300 ms after sportType stops changing ───
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStats();
    }, 300);

    // On cleanup: cancel the timer AND abort any in-flight request
    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [sportType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: 'K' toggles sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'k' || e.key === 'K') && 
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        setIsSidebarExpanded(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── PERF-3: fetchStats with AbortController ──────────────────────────────────
  const fetchStats = async () => {
    // Cancel the previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/v1/stats?sport_type=${sportType}`, {
        signal: abortControllerRef.current.signal,
      });
      setStats(res.data);
    } catch (err) {
      // CanceledError is expected when a newer request supersedes this one
      if (axios.isCancel(err) || err.name === 'CanceledError') return;
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const renderHeatmap = (activeMetric = 'count') => {
    const days = [];
    const today = new Date();
    
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
        const p = val / maxVal;
        if (p > 0.75) return 'level-4';
        if (p > 0.5)  return 'level-3';
        if (p > 0.25) return 'level-2';
        return 'level-1';
    };

    const unitMap = { count: 'activities', dist: 'KM', time: 'h', elev: 'm', cal: 'kcal' };
    const monthLabels = [];
    let lastMonth = -1;
    const daysToShow = 364 + today.getDay(); 

    for (let i = daysToShow; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const data = stats.heatmap[dateStr] || { count: 0, dist: 0, time: 0, elev: 0, cal: 0 };
      const val = data[activeMetric] || 0;
      
      if (date.getDay() === 0) {
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
                    <div style={{ 
                        position: 'relative',
                        height: '22px',
                        width: '100%',
                        marginBottom: '4px'
                    }}>
                        {monthLabels}
                    </div>
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
        <div style={{ position: 'relative' }}>
          <div className="loader-pulse"></div>
          <div className="loader-ring"></div>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <Activity color="var(--accent-cyan)" size={32} />
          </div>
        </div>
        <div className="loader-text">INITIALIZING TRACKRECORD...</div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview':    return <Dashboard stats={stats} setActiveTab={setActiveTab} renderHeatmap={renderHeatmap} setInitialSearch={setInitialSearch} />;
      case 'Activities':  return <Activities stats={stats} setActiveTab={setActiveTab} initialSearch={initialSearch} onSearchClear={() => setInitialSearch('')} sportType={sportType} />;
      case 'Analytics':   return <Analytics stats={stats} sportType={sportType} />;
      case 'Eddington':   return <Eddington stats={stats} sportType={sportType} />;
      case 'Heatmap':     return <Heatmap activities={stats.recent_activities} availableYears={stats.available_years} sportType={sportType} />;
      case 'Records':     return <Records stats={stats} setActiveTab={setActiveTab} setInitialSearch={setInitialSearch} sportType={sportType} />;
      case 'Gear':        return <Gear stats={stats} sportType={sportType} />;
      case 'Stats':       return <MonthlyStats stats={stats} renderHeatmap={renderHeatmap} sportType={sportType} />;
      case 'Challenges':  return <Challenges />;
      case 'Photos':      return <Photos sportType={sportType} />;
      case 'Rewind':      return <Rewind stats={stats} sportType={sportType} />;
      case 'Segments':    return <Segments sportType={sportType} />;
      default:            return <Dashboard stats={stats} setActiveTab={setActiveTab} />;
    }
  };

  const tabMetadata = {
    'Overview':    { title: 'DASHBOARD',              icon: LayoutDashboard },
    'Activities':  { title: 'ACTIVITY CENTER',        icon: Activity },
    'Stats':       { title: 'MONTHLY STATS',          icon: Calendar },
    'Analytics':   { title: 'PERFORMANCE ANALYTICS',  icon: TrendingUp },
    'Rewind':      { title: 'ANNUAL REWIND',          icon: Star },
    'Eddington':   { title: 'EDDINGTON SCORE',        icon: Award },
    'Heatmap':     { title: 'GLOBAL HEATMAP',         icon: Map },
    'Records':     { title: 'PERSONAL RECORDS',       icon: History },
    'Challenges':  { title: 'STRAVA CHALLENGES',      icon: Medal },
    'Photos':      { title: 'ACTIVITY GALLERY',       icon: Image },
    'Segments':    { title: 'SEGMENTS PERFORMANCE',   icon: Milestone },
    'Gear':        { title: 'EQUIPMENT TRACKING',     icon: Wrench }
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
          setIsMobileMenuOpen(false);
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

        {/* ── ARCH-2: Suspense wrapper for lazy-loaded pages ── */}
        <AnimatePresence mode="wait">
          <Suspense fallback={<TabLoader />}>
            {renderTabContent()}
          </Suspense>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;