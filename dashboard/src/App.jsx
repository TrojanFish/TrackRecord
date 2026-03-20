import React, { useState, useEffect, lazy, Suspense, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Activity, Map, Calendar,
  TrendingUp, Star, Award, History, Medal,
  Image, Wrench, Milestone, Flag, Globe
} from 'lucide-react';
import { useStats } from './hooks/useStats';

// Components (eagerly loaded — always visible)
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Lazy-load all page components — each is split into its own JS chunk
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
const CalendarPage = lazy(() => import('./pages/Calendar'));
const Milestones  = lazy(() => import('./pages/Milestones'));
const WorldMap    = lazy(() => import('./pages/WorldMap'));


// Error boundary to prevent a single bad page from crashing the whole app
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Page crash:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
          <p style={{ fontFamily: 'monospace' }}>
            Something went wrong loading this page.
          </p>
          <button
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [activeTab, setActiveTab] = useState('Overview');
  const [sportType, setSportType] = useState('Ride');
  const [initialSearch, setInitialSearch] = useState('');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Stats with built-in caching — switching Run/Ride won't re-fetch if cached
  const { stats, loading } = useStats(sportType);

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
      case 'Calendar':    return <CalendarPage stats={stats} />;
      case 'Milestones':  return <Milestones stats={stats} />;
      case 'WorldMap':    return <WorldMap stats={stats} />;
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
    'Gear':        { title: 'EQUIPMENT TRACKING',     icon: Wrench },
    'Calendar':    { title: 'ACTIVITY CALENDAR',      icon: Calendar },
    'Milestones':  { title: 'ACHIEVEMENT MILESTONES', icon: Flag },
    'WorldMap':    { title: 'ACTIVITY WORLD MAP',     icon: Globe },
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

        <AnimatePresence mode="wait">
          <ErrorBoundary key={activeTab}>
            <Suspense fallback={<TabLoader />}>
              {renderTabContent()}
            </Suspense>
          </ErrorBoundary>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
