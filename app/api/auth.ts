import axios, { InternalAxiosRequestConfig } from 'axios';

interface User {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  points: number;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data?: T;
}

// The backend puts this in `data` when the account is fine but the OTP could not
// be delivered (WhatsApp gateway down). Register/login/resend are all safe to
// retry in that case — register re-issues the OTP for an unverified account.
export const OTP_DELIVERY_FAILED = 'OTP_DELIVERY_FAILED';

export const isOtpDeliveryFailure = (response: ApiResponse<unknown>): boolean =>
  response.data === OTP_DELIVERY_FAILED;

interface OTPResponse {
  token: string;
  user: User;
}

const api = axios.create({
  baseURL: '/api/proxy',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to format Indonesian phone numbers
const formatPhoneNumber = (phone: string): string => {
  // Remove any non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Format with 62 prefix
  if (digitsOnly.startsWith('0')) {
    return '62' + digitsOnly.substring(1);
  } else if (!digitsOnly.startsWith('62')) {
    return '62' + digitsOnly;
  }
  
  return digitsOnly;
};

// Add auth token to requests when available
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = typeof window !== 'undefined' && localStorage.getItem('auth-storage') 
    ? JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
    : null;
    
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Register a new user
export const register = async (userData: {
  fullName: string;
  email: string;
  phoneNumber: string;
  captchaToken?: string;
  website?: string; // honeypot field
}): Promise<ApiResponse<null>> => {
  try {
    // Format phone number for Indonesian format
    const formattedPhoneNumber = formatPhoneNumber(userData.phoneNumber);
    
    const response = await api.post<ApiResponse<null>>('/api/v1/users/register', {
      fullName: userData.fullName,
      email: userData.email,
      phoneNumber: formattedPhoneNumber,
      website: userData.website || '', // honeypot
    }, {
      headers: userData.captchaToken ? {
        'X-Captcha-Token': userData.captchaToken
      } : {}
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data as ApiResponse<null>;
    }
    throw error;
  }
};

// Send OTP for login
export const login = async (phoneNumber: string, captchaToken?: string, website?: string): Promise<ApiResponse<null>> => {
  try {
    // Format phone number for Indonesian format
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    
    const response = await api.post<ApiResponse<null>>('/api/v1/users/login', {
      phoneNumber: formattedPhoneNumber,
      website: website || '', // honeypot
    }, {
      headers: captchaToken ? {
        'X-Captcha-Token': captchaToken
      } : {}
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data as ApiResponse<null>;
    }
    throw error;
  }
};

// Verify OTP
export const verifyOTP = async (phoneNumber: string, otp: string): Promise<ApiResponse<OTPResponse>> => {
  try {
    // Format phone number for Indonesian format
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    
    const response = await api.post<ApiResponse<OTPResponse>>('/api/v1/users/verify-otp', {
      phoneNumber: formattedPhoneNumber,
      otp,
    });
    
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data as ApiResponse<OTPResponse>;
    }
    throw error;
  }
};

// Resend OTP
export const resendOTP = async (phoneNumber: string, captchaToken?: string): Promise<ApiResponse<null>> => {
  try {
    // Format phone number for Indonesian format
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    
    const response = await api.post<ApiResponse<null>>('/api/v1/users/resend-otp', {
      phoneNumber: formattedPhoneNumber
    }, {
      headers: captchaToken ? {
        'X-Captcha-Token': captchaToken
      } : {}
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data as ApiResponse<null>;
    }
    throw error;
  }
};

// Get user profile (to be used after login)
export const getUserProfile = async (): Promise<ApiResponse<any>> => {
  try {
    const response = await api.get<ApiResponse<any>>('/api/v1/users/profile');
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data as ApiResponse<any>;
    }
    throw error;
  }
}; 