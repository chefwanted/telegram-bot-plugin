/**
 * Core HTTP Client voor Telegram Bot API
 * Implementeert HTTP requests met retry logic en error handling
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  ApiResponse,
  TelegramApiError,
  TelegramBotError,
} from '../types/telegram';
import type {
  RequestConfig,
  RequestResult,
  ApiRequestError,
  ApiTimeoutError,
  ApiRetryExhaustedError,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_BASE_URL = 'https://api.telegram.org';
const DEFAULT_TIMEOUT = 30000; // 30 seconden
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 seconde

// =============================================================================
// API Client Class
// =============================================================================

export class ApiClient {
  private axios: AxiosInstance;
  private config: Required<RequestConfig>;

  constructor(
    private botToken: string,
    config: RequestConfig = {}
  ) {
    this.config = {
      timeout: config.timeout || DEFAULT_TIMEOUT,
      retries: config.retries || DEFAULT_RETRIES,
      retryDelay: config.retryDelay || DEFAULT_RETRY_DELAY,
    };

    this.axios = axios.create({
      baseURL: config.timeout ? undefined : DEFAULT_BASE_URL,
      timeout: this.config.timeout,
    });
  }

  /**
   * Voer een API call uit met retry logic
   */
  async call<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const url = `/bot${this.botToken}/${method}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await this.axios.post<ApiResponse<T>>(url, params);

        if (response.data.ok) {
          return response.data.result as T;
        }

        // API returned an error
        throw this.createApiError(
          response.data.error_code,
          response.data.description
        );
      } catch (error) {
        lastError = this.handleError(error);

        // Bij laatste poging, gooi de error
        if (attempt === this.config.retries) {
          throw new ApiRetryExhaustedError(
            `API call ${method} failed after ${attempt + 1} attempts`,
            attempt + 1,
            lastError
          );
        }

        // Wacht voor retry
        await this.delay(this.config.retryDelay * (attempt + 1));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Unknown error in API call');
  }

  /**
   * GET request helper
   */
  async get<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const url = `/bot${this.botToken}/${method}`;

    try {
      const response = await this.axios.get<ApiResponse<T>>(url, {
        params,
        timeout: this.config.timeout,
      });

      if (response.data.ok) {
        return response.data.result as T;
      }

      throw this.createApiError(
        response.data.error_code,
        response.data.description
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * POST request helper
   */
  async post<T>(
    method: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    return this.call<T>(method, data);
  }

  /**
   * Upload file helper
   */
  async uploadFile<T>(
    method: string,
    formData: Record<string, string | Buffer | Blob>
  ): Promise<T> {
    const url = `/bot${this.botToken}/${method}`;

    try {
      const FormDataClass = typeof FormData !== 'undefined'
        ? FormData
        : await import('form-data').then(m => m.default);

      const formDataInstance = new FormDataClass();

      for (const [key, value] of Object.entries(formData)) {
        formDataInstance.append(key, value);
      }

      const response = await this.axios.post<ApiResponse<T>>(
        url,
        formDataInstance,
        {
          headers: formDataInstance.getHeaders?.() || {},
          timeout: this.config.timeout * 2, // Dubbele timeout voor uploads
        }
      );

      if (response.data.ok) {
        return response.data.result as T;
      }

      throw this.createApiError(
        response.data.error_code,
        response.data.description
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Handle en transformeer errors
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return new ApiTimeoutError(
          'Request timeout',
          this.config.timeout
        );
      }

      if (error.response) {
        const statusCode = error.response.status;
        return new ApiRequestError(
          `HTTP ${statusCode}: ${error.response.statusText}`,
          statusCode,
          error.response.data
        );
      }

      if (error.request) {
        return new ApiRequestError(
          'No response received from server'
        );
      }
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  /**
   * Create Telegram API error
   */
  private createApiError(
    errorCode: number | undefined,
    description: string | undefined
  ): TelegramApiError {
    const error = new Error() as TelegramApiError;
    error.name = 'TelegramApiError';
    error.errorCode = errorCode || 0;
    error.description = description || 'Unknown error';
    error.message = `Telegram API Error ${error.errorCode}: ${error.description}`;
    return error;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Axios cleanup if needed
  }
}

// =============================================================================
// Type Guards
// =============================================================================

export function isApiRequestError(error: Error): error is ApiRequestError {
  return error.name === 'ApiRequestError';
}

export function isApiTimeoutError(error: Error): error is ApiTimeoutError {
  return error.name === 'ApiTimeoutError';
}

export function isApiRetryExhaustedError(
  error: Error
): error is ApiRetryExhaustedError {
  return error.name === 'ApiRetryExhaustedError';
}
