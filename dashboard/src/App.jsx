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


  const renderHeatmap = () => {
    const days = [];
    const today = new Date();
    for (let i = 365; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = stats.heatmap[dateStr] || 0;
      const colorClass = count >= 5 ? 'level-4' : count >= 3 ? 'level-3' : count >= 2 ? 'level-2' : count >= 1 ? 'level-1' : '';
      days.push(
        <div key={dateStr} className={`heatmap-day ${colorClass}`} title={`${dateStr}: ${count} activities`} />
      );
    }
    return days;
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
      case 'Overview': return <Dashboard stats={stats} />;
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
