import { APIResponse } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.zaiclub.com';

class APIService {
  private getHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async get<T = any>(
    endpoint: string,
    token?: string
  ): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

  async post<T = any>(
    endpoint: string,
    body: any,
    token?: string
  ): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

  async put<T = any>(
    endpoint: string,
    body: any,
    token?: string
  ): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(token),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

  async delete<T = any>(
    endpoint: string,
    token?: string
  ): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }
}

export const apiService = new APIService();
