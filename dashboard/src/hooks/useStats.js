/**
 * useStats — Custom hook for fetching and caching sport statistics.
 *
 * Caches results per sport_type in module-level memory so switching
 * between Run / Ride / All does NOT trigger redundant API round-trips.
 * Cache is invalidated after CACHE_TTL_MS (default: 5 minutes) to ensure
 * fresh data if the user leaves the tab open for a long time.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE =
  window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level cache shared across all component instances
const statsCache = new Map(); // key: sportType, value: { data, timestamp }

const DEFAULT_STATS = {
  total_distance: 0,
  total_count: 0,
  recent_activities: [],
  heatmap: {},
  yearly: {},
  monthly_trends: [],
  breakdown: {},
  eddington: { Run: 0, Ride: 0 },
  yoy_cumulative: [],
  available_years: [],
  weekly_trends: [],
  records: {},
  time_preference: [],
  weekday_preference: [],
  gear_stats: [],
  training_load: [],
  records_trends: {},
  daily_stats: [],
  recent_form: {
    this_week: { distance: 0, stress: 0, count: 0 },
    last_week: { distance: 0, stress: 0, count: 0 },
  },
  athlete_metrics: { vo2_estimate: 0, zones: {}, max_hr: 0, resting_hr: 0 },
  athlete_profile: null,
  athlete_radar: [],
  dashboard_records: [],
  activity_pattern: [],
};

function isCacheValid(entry) {
  return entry && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

export function useStats(sportType) {
  const [stats, setStats] = useState(() => {
    // Seed from cache immediately to avoid blank render flash
    const cached = statsCache.get(sportType);
    return isCacheValid(cached) ? cached.data : DEFAULT_STATS;
  });
  const [loading, setLoading] = useState(() => {
    const cached = statsCache.get(sportType);
    return !isCacheValid(cached);
  });
  const [error, setError] = useState(null);

  // Keep a ref so the abort controller survives re-renders
  const abortRef = useRef(null);

  const fetchStats = useCallback(
    async (forceRefresh = false) => {
      // Serve from cache if valid and not explicitly forcing a refresh
      if (!forceRefresh) {
        const cached = statsCache.get(sportType);
        if (isCacheValid(cached)) {
          setStats(cached.data);
          setLoading(false);
          return;
        }
      }

      // Cancel any in-flight request for a previous sport_type
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const res = await axios.get(
          `${API_BASE}/api/v1/stats?sport_type=${sportType}`,
          { signal: abortRef.current.signal }
        );
        statsCache.set(sportType, { data: res.data, timestamp: Date.now() });
        setStats(res.data);
      } catch (err) {
        if (axios.isCancel(err) || err.name === 'CanceledError') {
          // Request was aborted — no state update needed
          return;
        }
        console.error('[useStats] Failed to fetch stats:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [sportType]
  );

  useEffect(() => {
    fetchStats();
    return () => {
      // Abort on unmount or sportType change
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchStats]);

  /** Call this to force a fresh pull (e.g. after a manual sync). */
  const refresh = useCallback(() => {
    statsCache.delete(sportType);
    fetchStats(true);
  }, [sportType, fetchStats]);

  return { stats, loading, error, refresh };
}

/** Imperatively invalidate the cache for a given sport_type (or all). */
export function invalidateStatsCache(sportType) {
  if (sportType) {
    statsCache.delete(sportType);
  } else {
    statsCache.clear();
  }
}
