import { ClientAuth } from './auth';

const API_BASE_URL = 'https://metaapi.zuperior.com/api/client';

export interface ApiResponse<T = any> {
    data: T;
    error?: string;
    status: number;
}

export class ApiClient {
    private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const token = ClientAuth.getToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`; // Assuming Bearer token
        }

        const config: RequestInit = {
            ...options,
            headers,
        };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Endpoint ${endpoint} failed: ${response.status} - ${errorBody}`);
        }

        // Return JSON if content-type is json, otherwise text
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }

        return (await response.text()) as unknown as T;
    }

    public static async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    public static async post<T>(endpoint: string, body: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    public static async put<T>(endpoint: string, body: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    public static async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }
}
