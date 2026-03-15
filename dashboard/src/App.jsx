import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';

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

const API_BASE = 'http://localhost:8000';

function App() {
  const [stats, setStats] = useState({ 
    total_distance: 0, total_count: 0, recent_activities: [], 
    heatmap: {}, yearly: {}, monthly_trends: [], breakdown: {},
    eddington: { Run: 0, Ride: 0 }, yoy_cumulative: [], available_years: [],
    weekly_trends: [], records: {}, time_preference: [],
    weekday_preference: [], gear_stats: [], training_load: [],
    records_trends: {}, daily_stats: [],
    recent_form: { this_week: { distance: 0, stress: 0, count: 0 }, last_week: { distance: 0, stress: 0, count: 0 } },
    athlete_metrics: { vo2_estimate: 0, zones: {}, max_hr: 0, resting_hr: 0 }
  });
  const [activeTab, setActiveTab] = useState('Overview');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/stats`);
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
        if (currentMonth !== lastMonth) {
          monthLabels.push(
            <div key={dateStr} style={{ 
              gridColumn: `span 1`, 
              fontSize: '0.65rem', 
              opacity: 0.4, 
              fontWeight: 800,
              textAlign: 'left'
            }}>
              {date.toLocaleString('en-US', { month: 'short' })}
            </div>
          );
          lastMonth = currentMonth;
        } else {
          monthLabels.push(<div key={`empty-${dateStr}`} />);
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingBottom: '10px' }}>
            {/* Week Labels Column */}
            <div style={{ 
                display: 'grid', 
                gridTemplateRows: '20px repeat(7, 12px)', 
                gap: '3px',
                fontSize: '0.6rem', 
                opacity: 0.3,
                fontWeight: 800,
                marginTop: '1px',
                textAlign: 'right',
                width: '24px',
                flexShrink: 0
            }}>
                <div style={{ height: '20px' }}></div>
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
            </div>

            <div style={{ flex: 1 }}>
                {/* Month Labels Row */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(53, 1fr)', 
                    gap: '3px',
                    height: '20px',
                    marginBottom: '4px'
                }}>
                    {monthLabels}
                </div>
                {/* Heatmap Grid */}
                <div className="heatmap-container" style={{ 
                    gridTemplateColumns: 'repeat(53, 1fr)',
                    gridTemplateRows: 'repeat(7, 12px)',
                    gap: '3px'
                }}>
                    {days}
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
      case 'Overview': return <Dashboard stats={stats} setActiveTab={setActiveTab} renderHeatmap={renderHeatmap} />;
      case 'Activities': return <Activities stats={stats} />;
      case 'Analytics': return <Analytics stats={stats} />;
      case 'Eddington': return <Eddington stats={stats} />;
      case 'Heatmap': return <Heatmap activities={stats.recent_activities} availableYears={stats.available_years} />;
      case 'Records': return <Records stats={stats} />;
      case 'Gear': return <Gear stats={stats} />;
      case 'Stats': return <MonthlyStats stats={stats} renderHeatmap={renderHeatmap} />;
      case 'Challenges': return <Challenges />;
      case 'Photos': return <Photos />;
      default: return <Dashboard stats={stats} />;
    }
  };

  return (
    <div className="app-container">
      <div className="dynamic-bg">
        <div className="bg-blob blob-1"></div>
        <div className="bg-blob blob-2"></div>
        <div className="bg-blob blob-3"></div>
      </div>
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isExpanded={isSidebarExpanded} 
        setIsExpanded={setIsSidebarExpanded}
        stats={stats}
      />

      <main className="main-content">
        <Header title={activeTab.toUpperCase()} />
        <AnimatePresence mode="wait">
          {renderTabContent()}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
