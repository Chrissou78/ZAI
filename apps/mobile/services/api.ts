import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://zai-chi.vercel.app/api';
const TOKEN_KEY = 'zai_token';
const USER_KEY = 'zai_user';
const EC_KEY = 'zai_experience_card';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (res) => res,
      async (err) => {
        if (err.response?.status === 401) {
          await this.clearAuth();
        }
        return Promise.reject(err);
      }
    );
  }

  // ── Auth helpers ──
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }

  async getUser(): Promise<any | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  async setUser(user: any): Promise<void> {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  }

  async getExperienceCard(): Promise<any | null> {
    const raw = await SecureStore.getItemAsync(EC_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  async setExperienceCard(card: any): Promise<void> {
    if (card) {
      await SecureStore.setItemAsync(EC_KEY, JSON.stringify(card));
    } else {
      await SecureStore.deleteItemAsync(EC_KEY);
    }
  }

  async clearAuth(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(EC_KEY);
  }

  // ── HTTP methods ──
  get(path: string, params?: any) {
    return this.client.get(path, { params });
  }

  post(path: string, data?: any) {
    return this.client.post(path, data);
  }

  put(path: string, data?: any) {
    return this.client.put(path, data);
  }

  delete(path: string) {
    return this.client.delete(path);
  }
}

export const apiService = new ApiService();
