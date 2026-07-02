import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/* ── Cache configuration ── */
const CACHE_PREFIX = 'zai_cache_';
const DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes — serve from cache without network
const STALE_AGE = 30 * 60 * 1000;      // 30 minutes — serve stale + revalidate in background

// Per-route cache durations (ms) — override the default for specific endpoints
const CACHE_RULES: Record<string, { maxAge: number; staleAge: number }> = {
  '/products/user/':      { maxAge: 2 * 60 * 1000,  staleAge: 10 * 60 * 1000 },
  '/events':              { maxAge: 5 * 60 * 1000,  staleAge: 30 * 60 * 1000 },
  '/products/experience': { maxAge: 10 * 60 * 1000, staleAge: 60 * 60 * 1000 },
  '/community':           { maxAge: 2 * 60 * 1000,  staleAge: 10 * 60 * 1000 },
  '/users/me':            { maxAge: 5 * 60 * 1000,  staleAge: 30 * 60 * 1000 },
};

// Endpoints that should never be cached
const NO_CACHE_PATTERNS = [
  '/auth/',
  '/claim-upload/',
  '/claim-request',
  'mine=true',
];

interface CacheEntry {
  data: any;
  timestamp: number;
  url: string;
}

function getCacheKey(url: string, params?: any): string {
  const paramStr = params ? JSON.stringify(params) : '';
  return CACHE_PREFIX + url + (paramStr ? '_' + paramStr : '');
}

function getCacheRules(url: string): { maxAge: number; staleAge: number } {
  for (const pattern of Object.keys(CACHE_RULES)) {
    if (url.includes(pattern)) return CACHE_RULES[pattern];
  }
  return { maxAge: DEFAULT_MAX_AGE, staleAge: STALE_AGE };
}

function shouldCache(url: string): boolean {
  return !NO_CACHE_PATTERNS.some(pattern => url.includes(pattern));
}

function readCache(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: any, url: string): void {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now(), url };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // sessionStorage full — clear oldest entries
    clearOldestCacheEntries();
    try {
      sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now(), url }));
    } catch { /* give up */ }
  }
}

function clearOldestCacheEntries(): void {
  const entries: { key: string; timestamp: number }[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const entry = JSON.parse(sessionStorage.getItem(key)!) as CacheEntry;
        entries.push({ key, timestamp: entry.timestamp });
      } catch {
        sessionStorage.removeItem(key!);
      }
    }
  }
  // Remove oldest half
  entries.sort((a, b) => a.timestamp - b.timestamp);
  const removeCount = Math.max(Math.ceil(entries.length / 2), 1);
  for (let i = 0; i < removeCount; i++) {
    sessionStorage.removeItem(entries[i].key);
  }
}

/* ── In-flight request deduplication ── */
const inflightRequests = new Map<string, Promise<AxiosResponse>>();

class APIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('zai_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response?.status === 401 &&
          error.response?.headers?.['content-type']?.includes('application/json') &&
          !error.config?.url?.includes('/auth/login')
        ) {
          localStorage.removeItem('zai_token');
          localStorage.removeItem('zai_user');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    const fullUrl = url + (config?.params ? JSON.stringify(config.params) : '');

    // Skip cache for non-cacheable endpoints
    if (!shouldCache(url)) {
      return this.deduplicatedGet(url, config);
    }

    const cacheKey = getCacheKey(url, config?.params);
    const cached = readCache(cacheKey);
    const rules = getCacheRules(url);

    if (cached) {
      const age = Date.now() - cached.timestamp;

      if (age < rules.maxAge) {
        // Fresh cache — return immediately, no network request
        return Promise.resolve({
          data: cached.data,
          status: 200,
          statusText: 'OK (cached)',
          headers: {},
          config: {} as any,
        } as AxiosResponse<ApiResponse<T>>);
      }

      if (age < rules.staleAge) {
        // Stale cache — return immediately, revalidate in background
        this.deduplicatedGet(url, config).then((response) => {
          writeCache(cacheKey, response.data, url);
        }).catch(() => { /* background refresh failed, stale data still served */ });

        return Promise.resolve({
          data: cached.data,
          status: 200,
          statusText: 'OK (stale)',
          headers: {},
          config: {} as any,
        } as AxiosResponse<ApiResponse<T>>);
      }
    }

    // No cache or expired — fetch fresh and cache
    const request = this.deduplicatedGet<T>(url, config);
    request.then((response) => {
      writeCache(cacheKey, response.data, url);
    }).catch(() => {});

    return request;
  }

  /** Deduplicates concurrent identical GET requests */
  private deduplicatedGet<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    const key = url + (config?.params ? JSON.stringify(config.params) : '');

    const existing = inflightRequests.get(key);
    if (existing) return existing as Promise<AxiosResponse<ApiResponse<T>>>;

    const request = this.client.get<ApiResponse<T>>(url, config).finally(() => {
      inflightRequests.delete(key);
    });

    inflightRequests.set(key, request);
    return request;
  }

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    // Invalidate related caches on mutations
    this.invalidateRelatedCaches(url);
    return this.client.post(url, data, config);
  }

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    this.invalidateRelatedCaches(url);
    return this.client.put(url, data, config);
  }

  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    this.invalidateRelatedCaches(url);
    return this.client.delete(url, config);
  }

  /** Clear all cached data (call on logout) */
  clearCache(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  }

  /** After POST/PUT/DELETE, remove caches for the same resource group */
  private invalidateRelatedCaches(mutationUrl: string): void {
    // Extract the base resource path (e.g., "/products" from "/products/claim-request")
    const segments = mutationUrl.split('/').filter(Boolean);
    const base = segments[0] || '';

    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX) && key.includes('/' + base)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  }
}

export const apiService = new APIService();
