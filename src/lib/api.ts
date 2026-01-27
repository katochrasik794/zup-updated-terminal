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

// Log the base URL for debugging
if (typeof window !== 'undefined') {
  const runtimeURL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'NOT SET';
  console.log('[API Client] Build-time base URL:', API_BASE_URL);
  console.log('[API Client] Runtime environment variable:', {
    NEXT_PUBLIC_BACKEND_API_URL: runtimeURL,
  });
  
  // Check if runtime URL differs from build-time URL (indicates env var was set after build)
  if (runtimeURL !== 'NOT SET' && runtimeURL !== API_BASE_URL) {
    console.warn('[API Client] WARNING: Runtime env var differs from build-time URL!');
    console.warn('[API Client] Build-time:', API_BASE_URL);
    console.warn('[API Client] Runtime:', runtimeURL);
    console.warn('[API Client] This means env var was set AFTER build. Rebuild required!');
  }
  
  if (API_BASE_URL.includes('metaapi')) {
    console.warn('[API Client] WARNING: API base URL points to MetaAPI instead of local backend!');
    console.warn('[API Client] Set NEXT_PUBLIC_BACKEND_API_URL=http://localhost:5000 in .env.local');
  }
  if (API_BASE_URL.includes('localhost') && runtimeURL === 'NOT SET') {
    console.error('[API Client] ERROR: Using localhost:5000 in production!');
    console.error('[API Client] NEXT_PUBLIC_BACKEND_API_URL is NOT SET - set it in Vercel and rebuild!');
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  user?: T;
  token?: string;
  errors?: string[];
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
    // ALWAYS check environment variable first - this is the source of truth
    // In Next.js, process.env.NEXT_PUBLIC_* vars are embedded at build time and available in browser
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    
    // Check if we're in production (Vercel deployment)
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname.includes('vercel.app') || 
       window.location.hostname.includes('vercel.com') ||
       (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')));
    
    if (backendUrl && typeof backendUrl === 'string' && backendUrl.trim() !== '') {
      const trimmedUrl = backendUrl.trim();
      // Log if we're overriding the constructor's baseURL (indicates env var was set after build)
      if (typeof window !== 'undefined' && trimmedUrl !== this.baseURL && this.baseURL.includes('localhost')) {
        console.log('[API Client] Using runtime env var:', trimmedUrl, '(overriding build-time:', this.baseURL + ')');
      }
      return trimmedUrl;
    }

    // If env var is not set and we're in production, use the production backend URL
    if (isProduction && (!backendUrl || backendUrl.trim() === '')) {
      const productionBackendUrl = 'https://zup-terminal-backend.onrender.com';
      console.warn('[API Client] NEXT_PUBLIC_BACKEND_API_URL not set in build, but detected production environment.');
      console.warn('[API Client] Using hardcoded production URL:', productionBackendUrl);
      console.warn('[API Client] IMPORTANT: Set NEXT_PUBLIC_BACKEND_API_URL in Vercel and rebuild to fix this properly!');
      return productionBackendUrl;
    }

    // Fallback to localhost for local development
    if (typeof window !== 'undefined') {
      console.warn('[API Client] NEXT_PUBLIC_BACKEND_API_URL not found, using fallback:', this.baseURL || 'http://localhost:5000');
    }
    
    return this.baseURL || 'http://localhost:5000';
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
      
      // Enhanced logging to debug URL issues
      if (typeof window !== 'undefined') {
        console.log(`[API Client] Making request to: ${url}`);
        console.log(`[API Client] URL Debug Info:`, {
          endpoint,
          envVar: process.env.NEXT_PUBLIC_BACKEND_API_URL || 'NOT SET',
          usedURL: baseURL,
          constructorURL: this.baseURL,
          envVarMatchesUsed: process.env.NEXT_PUBLIC_BACKEND_API_URL === baseURL,
        });
        
        // Warn if we're using localhost in what appears to be production
        if (baseURL.includes('localhost') && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
          console.error('[API Client] ERROR: Using localhost in production!');
          console.error('[API Client] Current hostname:', window.location.hostname);
          console.error('[API Client] Env var value:', process.env.NEXT_PUBLIC_BACKEND_API_URL);
          console.error('[API Client] This usually means the build was done BEFORE env var was set in Vercel.');
          console.error('[API Client] Solution: Set NEXT_PUBLIC_BACKEND_API_URL in Vercel, then trigger a NEW deployment.');
        }
      }

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
        console.error(`[API Client] Network error - Backend server may not be running at ${currentBaseURL}`);
        if (currentBaseURL.includes('localhost') && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
          console.error('[API Client] CRITICAL: Using localhost in production!');
          console.error('[API Client] Env var:', process.env.NEXT_PUBLIC_BACKEND_API_URL || 'NOT SET');
          console.error('[API Client] You must rebuild the app AFTER setting NEXT_PUBLIC_BACKEND_API_URL in Vercel!');
        }
        throw new Error(`Backend server is not reachable at ${currentBaseURL}. Please ensure the server is running.`);
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
