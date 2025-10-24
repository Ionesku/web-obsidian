/**
 * API client for Obsidian Web backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiError {
  detail: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: 'An error occurred',
      }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  // Auth endpoints
  async register(username: string, email: string, password: string) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(username: string, password: string): Promise<{ access_token: string }> {
    const response = await this.request<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(response.access_token);
    return response;
  }

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  // File endpoints
  async listFiles(folder: string = '') {
    const query = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    return this.request(`/api/files/list${query}`);
  }

  async getFile(path: string) {
    return this.request(`/api/files/${path}`);
  }

  async createFile(path: string, content: string) {
    return this.request('/api/files/', {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    });
  }

  async updateFile(path: string, content: string) {
    return this.request(`/api/files/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    });
  }

  async deleteFile(path: string) {
    return this.request(`/api/files/${path}`, {
      method: 'DELETE',
    });
  }

  async renameFile(oldPath: string, newPath: string) {
    return this.request('/api/files/rename', {
      method: 'POST',
      body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
    });
  }

  async getBacklinks(path: string) {
    return this.request(`/api/files/${path}/backlinks`);
  }

  async getDailyNote(date?: string) {
    const dateParam = date ? `/${date}` : '';
    return this.request(`/api/files/daily${dateParam}`);
  }

  async uploadAttachment(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}/api/files/upload`;
    const headers: HeadersInit = {};

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: 'Upload failed',
      }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  // Search endpoints
  async search(query: string, limit: number = 50) {
    return this.request(`/api/search/?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async searchByTag(tag: string, limit: number = 50) {
    return this.request(`/api/search/tags/${encodeURIComponent(tag)}?limit=${limit}`);
  }

  async reindexSearch() {
    return this.request('/api/search/reindex', { method: 'POST' });
  }

  async getSearchStats() {
    return this.request('/api/search/stats');
  }

  // Canvas endpoints
  async listCanvases() {
    return this.request('/api/canvas/list');
  }

  async getCanvas(name: string) {
    return this.request(`/api/canvas/${name}`);
  }

  async saveCanvas(name: string, data: any) {
    return this.request(`/api/canvas/${name}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCanvas(name: string) {
    return this.request(`/api/canvas/${name}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;

