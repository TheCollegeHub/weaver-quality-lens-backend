import { AxiosError } from 'axios';

/**
 * Custom error class for Azure DevOps API errors
 * Provides structured error handling with retry logic and status codes
 */
export class AzureApiError extends Error {
  public statusCode: number;
  public code: string;
  public isRetryable: boolean;
  public timestamp: string;

  constructor(message: string, statusCode: number, code: string, isRetryable = false) {
    super(message);
    this.name = 'AzureApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.isRetryable = isRetryable;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Standard error response interface for API responses
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  timestamp: string;
}

/**
 * Error codes enum for consistent error identification
 */
export enum ErrorCodes {
  // Configuration errors
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_CONFIG = 'INVALID_CONFIG',
  
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_UNAVAILABLE = 'RESOURCE_UNAVAILABLE',
  
  // Rate limiting & Service errors
  RATE_LIMIT = 'RATE_LIMIT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Network & Connection errors
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  
  // Data validation errors
  EMPTY_RESPONSE = 'EMPTY_RESPONSE',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  
  // Resource limits
  RESOURCE_LIMIT = 'RESOURCE_LIMIT',
  
  // Generic errors
  API_ERROR = 'API_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Utility class for handling Azure DevOps API errors
 */
export class AzureErrorHandler {
  /**
   * Converts Axios errors to structured AzureApiError instances
   */
  static handleAxiosError(error: AxiosError, context?: string): AzureApiError {
    const statusCode = error.response?.status || 500;
    const errorData = error.response?.data as { message?: string } || {};
    const errorMessage = errorData.message || error.message;
    const contextPrefix = context ? `${context}: ` : '';

    switch (statusCode) {
      case 401:
        return new AzureApiError(
          `${contextPrefix}Invalid or expired Azure DevOps token. Please check your ADO_PERSONAL_ACCESS_TOKEN.`,
          401,
          ErrorCodes.UNAUTHORIZED
        );

      case 403:
        return new AzureApiError(
          `${contextPrefix}Insufficient permissions. Token requires appropriate permissions for this operation.`,
          403,
          ErrorCodes.FORBIDDEN
        );

      case 404:
        return new AzureApiError(
          `${contextPrefix}Resource not found or does not exist.`,
          404,
          ErrorCodes.NOT_FOUND
        );

      case 429:
        return new AzureApiError(
          `${contextPrefix}Azure DevOps API rate limit exceeded. Please try again later.`,
          429,
          ErrorCodes.RATE_LIMIT,
          true
        );

      case 503:
        return new AzureApiError(
          `${contextPrefix}Azure DevOps service is temporarily unavailable.`,
          503,
          ErrorCodes.SERVICE_UNAVAILABLE,
          true
        );

      default:
        return new AzureApiError(
          `${contextPrefix}Azure DevOps API error: ${errorMessage}`,
          statusCode,
          ErrorCodes.API_ERROR,
          statusCode >= 500
        );
    }
  }

  /**
   * Handles network and connection errors
   */
  static handleNetworkError(error: any, context?: string): AzureApiError {
    const networkError = error as { code?: string; message?: string };
    const contextPrefix = context ? `${context}: ` : '';

    if (networkError.code === 'ECONNABORTED' || networkError.code === 'ETIMEDOUT') {
      return new AzureApiError(
        `${contextPrefix}Request timeout while connecting to Azure DevOps API.`,
        408,
        ErrorCodes.TIMEOUT,
        true
      );
    }

    if (networkError.code === 'ENOTFOUND' || networkError.code === 'ECONNREFUSED') {
      return new AzureApiError(
        `${contextPrefix}Unable to connect to Azure DevOps API. Please check network connectivity.`,
        503,
        ErrorCodes.NETWORK_ERROR,
        true
      );
    }

    return new AzureApiError(
      `${contextPrefix}Network error: ${networkError.message || 'Unknown network error'}`,
      503,
      ErrorCodes.CONNECTION_ERROR,
      true
    );
  }

  /**
   * Handles configuration validation errors
   */
  static handleConfigError(missingVar: string): AzureApiError {
    return new AzureApiError(
      `${missingVar} environment variable is not configured`,
      500,
      ErrorCodes.MISSING_CONFIG
    );
  }

  /**
   * Handles data validation errors
   */
  static handleDataError(message: string, code: ErrorCodes = ErrorCodes.INVALID_RESPONSE): AzureApiError {
    return new AzureApiError(message, 502, code);
  }

  /**
   * Generic error handler for unknown errors
   */
  static handleUnknownError(error: any, context?: string): AzureApiError {
    const contextPrefix = context ? `${context}: ` : '';
    const message = error?.message || 'Unknown error occurred';
    
    return new AzureApiError(
      `${contextPrefix}Unexpected error: ${message}`,
      500,
      ErrorCodes.UNKNOWN_ERROR
    );
  }

  /**
   * Creates an ErrorResponse object for API responses
   */
  static createErrorResponse(error: AzureApiError): ErrorResponse {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      retryable: error.isRetryable,
      timestamp: error.timestamp
    };
  }

  /**
   * Validates environment variables and throws appropriate errors
   */
  static validateEnvironment(variables: { [key: string]: string | undefined }): void {
    for (const [key, value] of Object.entries(variables)) {
      if (!value) {
        throw this.handleConfigError(key);
      }
    }
  }
}