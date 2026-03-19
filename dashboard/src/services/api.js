/**
 * dashboard/src/services/api.js
 *
 * ARCH-3: 统一 API 服务层
 * - 单一 axios 实例，统一 baseURL、超时、错误拦截
 * - 消除各组件文件中重复的 `const API_BASE = ...` 定义
 * - 所有接口以具名函数导出，修改路径只需改这一个文件
 */

import axios from 'axios';

// ─── Base configuration ───────────────────────────────────────────────────────
const API_BASE =
  window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
});

// Global error interceptor — logs all non-cancellation errors
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!axios.isCancel(err)) {
      console.error(`[API] ${err.config?.method?.toUpperCase()} ${err.config?.url} →`, err.message);
    }
    return Promise.reject(err);
  }
);

export default client;

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * Fetch aggregated sports statistics.
 * @param {string|null} sportType  'Run' | 'Ride' | null (both)
 * @param {AbortSignal} [signal]   Optional AbortController signal for cancellation
 */
export const fetchStats = (sportType, signal) =>
  client.get('/api/v1/stats', {
    params: sportType ? { sport_type: sportType } : {},
    signal,
  });

// ─── Activities ───────────────────────────────────────────────────────────────

/**
 * Fetch paginated activity list.
 * @param {{ sport_type?, limit?, offset?, search?, year? }} params
 */
export const fetchActivities = (params = {}) =>
  client.get('/api/v1/activities', { params });

/**
 * Fetch full detail for a single activity.
 * @param {string|number} id
 */
export const fetchActivityDetail = (id) =>
  client.get(`/api/v1/activity/${id}`);

// ─── Segments ─────────────────────────────────────────────────────────────────

/**
 * Fetch starred / starred-attempt segments.
 * @param {string|null} sportType
 */
export const fetchSegments = (sportType) =>
  client.get('/api/v1/segments', {
    params: sportType && sportType !== 'All' ? { sport_type: sportType } : {},
  });

/**
 * Fetch all efforts for a specific segment.
 * @param {number} segmentId
 */
export const fetchSegmentEfforts = (segmentId) =>
  client.get(`/api/v1/segment_efforts/${segmentId}`);

/**
 * Trigger a background Strava segment sync.
 * @param {number} [limit=20]
 */
export const syncSegments = (limit = 20) =>
  client.post(`/api/v1/sync_segments`, null, { params: { limit } });

// ─── Photos ───────────────────────────────────────────────────────────────────

/**
 * Fetch activity photos, optionally filtered by sport type.
 * @param {string|null} sportType
 */
export const fetchPhotos = (sportType) =>
  client.get('/api/v1/photos', {
    params: sportType ? { sport_type: sportType } : {},
  });

// ─── Challenges / Trophies ────────────────────────────────────────────────────

/** Fetch all Strava challenges / trophies grouped by month. */
export const fetchChallenges = () =>
  client.get('/api/v1/challenges');

/**
 * Import trophies by submitting raw Strava HTML.
 * @param {string} html  Raw page source from strava.com/athletes/…/trophies
 */
export const importTrophies = (html) =>
  client.post('/api/v1/challenges/import', { html });

// ─── Profile & Athlete ────────────────────────────────────────────────────────

/** Fetch cached Strava athlete profile. */
export const fetchProfile = () =>
  client.get('/api/v1/profile');

/** Fetch Rewind / year-in-review data. */
export const fetchRewind = (sportType, year, compareYear) =>
  client.get('/api/v1/rewind', {
    params: {
      sport_type: sportType,
      year,
      compare_year: compareYear,
    },
  });

// ─── Sync ─────────────────────────────────────────────────────────────────────

/** Trigger a full background sync. */
export const triggerFullSync = (force = false) =>
  client.post('/api/v1/sync', null, { params: { force } });

/** Fetch current sync status. */
export const fetchSyncStatus = () =>
  client.get('/api/v1/sync/status');