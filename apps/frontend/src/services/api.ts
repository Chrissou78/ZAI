import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ── Request deduplication cache ──
// Prevents the same GET request from being fired multiple times simultaneously
// (e.g. Dashboard + Sidebar both fetching /products/user/123)
const inflightRequests = new Map<string, Promise<AxiosResponse<any>>>();

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
    // Deduplicate identical GET requests that are already in-flight
    const cacheKey = url + (config?.params ? JSON.stringify(config.params) : '');
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) return inflight as Promise<AxiosResponse<ApiResponse<T>>>;

    const request = this.client.get<ApiResponse<T>>(url, config).finally(() => {
      inflightRequests.delete(cacheKey);
    });

    inflightRequests.set(cacheKey, request);
    return request;
  }

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.post(url, data, config);
  }

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.put(url, data, config);
  }

  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.delete(url, config);
  }
}

export const apiService = new APIService();
