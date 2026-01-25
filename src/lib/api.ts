/**
 * API Client for Backend Communication
 * 
 * NOTE: This should point to the LOCAL backend server (localhost:5000)
 * NOT to the external MetaAPI (metaapi.zuperior.com)
 * The MetaAPI is only accessed by the backend server, not the frontend.
 */

// Use a specific env var for the backend API, or default to localhost:5000
// Priority: NEXT_PUBLIC_BACKEND_API_URL > NEXT_PUBLIC_API_BASE_URL (if it's localhost) > default
const getBackendUrl = () => {
  // First check for explicit backend URL
  if (process.env.NEXT_PUBLIC_BACKEND_API_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_API_URL;
  }
  
  // Check if NEXT_PUBLIC_API_BASE_URL is set and is localhost (not metaapi)
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBaseUrl && (apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1'))) {
    return apiBaseUrl;
  }
  
  // Default to localhost:5000
  return 'http://localhost:5000';
};

const API_BASE_URL = getBackendUrl();

// Log the base URL for debugging
if (typeof window !== 'undefined') {
  console.log('[API Client] Initialized with base URL:', API_BASE_URL);
  if (API_BASE_URL.includes('metaapi')) {
    console.warn('[API Client] WARNING: API base URL points to MetaAPI instead of local backend!');
    console.warn('[API Client] Set NEXT_PUBLIC_BACKEND_API_URL=http://localhost:5000 in .env.local');
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  user?: T;
  token?: string;
  errors?: string[];
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
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
      const url = `${this.baseURL}${endpoint}`;
      console.log(`[API Client] Making request to: ${url}`);
      
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
        console.error(`[API Client] Network error - Backend server may not be running at ${this.baseURL}`);
        console.error('[API Client] Please ensure the backend server is running on port 5000');
        throw new Error('Backend server is not reachable. Please ensure the server is running.');
      }
      console.error('[API Request Error]:', error);
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

  ssoLogin: (token: string, clientId: string) =>
    apiClient.post('/api/auth/sso-login', { token, clientId }),
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
};
