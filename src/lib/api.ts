/**
 * API Client for Backend Communication
 * 
 * NOTE: This should point to the LOCAL backend server (localhost:5000)
 * NOT to the external MetaAPI (metaapi.zuperior.com)
 * The MetaAPI is only accessed by the backend server, not the frontend.
 */

// Use NEXT_PUBLIC_BACKEND_API_URL for backend API, or default to localhost:5000
// IMPORTANT: In Next.js, NEXT_PUBLIC_* variables are embedded at build time
// Make sure to set NEXT_PUBLIC_BACKEND_API_URL in Vercel environment variables before building
const getBackendUrl = () => {
  // Use NEXT_PUBLIC_BACKEND_API_URL if set
  if (process.env.NEXT_PUBLIC_BACKEND_API_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_API_URL;
  }

  // Default to localhost:5000 (only for local development)
  // In production, this should never be reached if NEXT_PUBLIC_BACKEND_API_URL is set in Vercel
  return 'http://localhost:5000';
};

const API_BASE_URL = getBackendUrl();

// Production: Console logs removed

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  user?: {
    name?: string;
    email?: string;
    id?: string;
    [key: string]: any;
  };
  token?: string;
  errors?: string[];
  mt5Account?: {
    accountId?: string;
    [key: string]: any;
  };
  [key: string]: any; // Allow for other fields like 'positions', 'pendingOrders'
}

class ApiClient {
  public baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Get the current base URL, re-evaluating environment variables at runtime
   * This ensures production builds use the correct API URL from environment variables
   * In Next.js, NEXT_PUBLIC_* variables are embedded at build time and available at runtime
   * ALWAYS use this method instead of this.baseURL to ensure correct URL in production
   */
  getBaseURL(): string {
    // 1. Check if environment variable is explicitly set (highest priority)
    // In Next.js, NEXT_PUBLIC_* variables are embedded at build time
    const envBackendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (envBackendUrl && typeof envBackendUrl === 'string' && envBackendUrl.trim() !== '') {
      return envBackendUrl.trim();
    }

    // 2. Check if we're in a production-like environment (Vercel deployment or any non-localhost domain)
    const isProduction = typeof window !== 'undefined' &&
      (window.location.hostname.includes('vercel.app') ||
        window.location.hostname.includes('vercel.com') ||
        (!window.location.hostname.includes('localhost') &&
          !window.location.hostname.includes('127.0.0.1') &&
          !window.location.hostname.includes('192.168')));

    // 3. If we're in production but no env var was provided, use the hardcoded default
    if (isProduction) {
      // DEFAULT production backend on Render
      return 'https://zup-terminal-backend.onrender.com';
    }

    // 4. Fallback to localhost for local development only
    return this.baseURL || 'http://localhost:5001';
  }

  /**
   * Get authentication token from localStorage or cookie
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null;

    // Try to get from localStorage first
    const token = localStorage.getItem('token');
    if (token) return token;

    // Could also check cookies if needed
    return null;
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('token', token);
  }

  /**
   * Clear authentication token
   */
  clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
  }

  /**
   * Make API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // CRITICAL: Always use getBaseURL() which checks runtime env vars
      // This ensures production uses the correct URL even if build was done before env var was set
      const baseURL = this.getBaseURL();
      const url = `${baseURL}${endpoint}`;

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for httpOnly cookies from backend
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      // Handle network errors (backend not running, CORS, etc.)
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        const currentBaseURL = this.getBaseURL();
        throw new Error(`Backend server is not reachable at ${currentBaseURL}. Please ensure the server is running.`);
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Auth API methods
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/api/auth/login', { email, password }),

  register: (email: string, password: string, name?: string, phone?: string) =>
    apiClient.post('/api/auth/register', { email, password, name, phone }),

  logout: () => apiClient.post('/api/auth/logout'),

  getCurrentUser: () => apiClient.get('/api/auth/me'),

  ssoLogin: (token: string, clientId: string, accountId?: string) =>
    apiClient.post('/api/auth/sso-login', { token, clientId, accountId }),
};

// Orders API methods
export interface PlaceMarketOrderParams {
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface PlacePendingOrderParams {
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  price: number;
  orderType: 'limit' | 'stop';
  stopLoss?: number;
  takeProfit?: number;
}

export interface ModifyPendingOrderParams {
  accountId: string;
  orderId: string;
  price?: number;
  volume?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export const ordersApi = {
  placeMarketOrder: (params: PlaceMarketOrderParams) =>
    apiClient.post('/api/orders/market', params),

  placePendingOrder: (params: PlacePendingOrderParams) =>
    apiClient.post('/api/orders/pending', params),

  modifyPendingOrder: (params: ModifyPendingOrderParams) =>
    apiClient.put(`/api/orders/pending/${params.orderId}`, {
      accountId: params.accountId,
      price: params.price,
      volume: params.volume,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
    }),
};

export interface ClosePositionParams {
  accountId: string;
  positionId: string | number;
  symbol?: string;
  volume?: number;
}

export interface CloseAllParams {
  accountId: string;
}

export interface ModifyPositionParams {
  accountId: string;
  positionId: string | number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export const positionsApi = {
  closePosition: (params: ClosePositionParams) =>
    apiClient.post(`/api/positions/${params.positionId}/close`, {
      accountId: params.accountId,
      symbol: params.symbol,
      volume: params.volume,
    }),

  closeAll: (params: CloseAllParams) =>
    apiClient.post('/api/positions/close-all', {
      accountId: params.accountId,
    }),

  modifyPosition: (params: ModifyPositionParams) =>
    apiClient.put(`/api/positions/${params.positionId}/modify`, {
      accountId: params.accountId,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      comment: params.comment,
    }),
};
