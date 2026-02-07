export interface LoginCredentials {
    AccountId: number;
    Password: string;
    DeviceId: string;
    DeviceType: string;
}

export interface LoginResponse {
    token?: string;
    error?: string;
    // Add other fields as discovered from the API response
    [key: string]: any;
}

const API_BASE_URL = 'https://metaapi.zuperior.com/api/client';

export class ClientAuth {
    private static token: string | null = null;

    /**
     * Authenticates the user and stores the session token.
     */
    public static async login(credentials: LoginCredentials): Promise<LoginResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/ClientAuth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Login failed:', response.status, errorText);
                throw new Error(`Login failed: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            
            // Assuming the token is in the response, mapped to a common property
            // We might need to adjust this based on actual response structure
            if (data.Token || data.token || data.accessToken) {
                this.token = data.Token || data.token || data.accessToken;
            } else {
                console.warn('Token not found in login response', data);
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    public static getToken(): string | null {
        return this.token;
    }

    public static isAuthenticated(): boolean {
        return !!this.token;
    }

    public static setToken(token: string) {
        this.token = token;
    }
}
