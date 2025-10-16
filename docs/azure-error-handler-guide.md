# Azure Error Handler Usage Guide

## Overview

The `AzureErrorHandler` utility class provides a standardized way to handle errors across all Azure DevOps API integrations in the application.

## Key Components

### 1. AzureApiError Class
A custom error class that extends the base Error class with additional properties:
- `statusCode`: HTTP status code
- `code`: Enum-based error code for programmatic handling
- `isRetryable`: Boolean indicating if the operation can be retried
- `timestamp`: ISO timestamp of when the error occurred

### 2. ErrorCodes Enum
Standardized error codes for consistent error identification across the application.

### 3. ErrorResponse Interface
Standard structure for API error responses.

## Usage Examples

### In Repository Layer
```typescript
import { AzureErrorHandler, AzureApiError, ErrorCodes } from '../utils/azure-error-handler';
import { AxiosError } from 'axios';

export async function fetchData() {
  // Validate environment variables
  AzureErrorHandler.validateEnvironment({
    ADO_PROJECT: process.env.ADO_PROJECT,
    ADO_TOKEN: process.env.ADO_TOKEN
  });

  try {
    const response = await azureClient.get('/some-endpoint');
    
    if (!response.data) {
      throw AzureErrorHandler.handleDataError('Empty response', ErrorCodes.EMPTY_RESPONSE);
    }
    
    return response.data;
  } catch (error) {
    if (error instanceof AzureApiError) {
      throw error;
    }
    
    if (error instanceof AxiosError) {
      throw AzureErrorHandler.handleAxiosError(error, 'fetchData');
    }
    
    throw AzureErrorHandler.handleNetworkError(error, 'fetchData');
  }
}
```

### In Controller Layer
```typescript
import { AzureApiError, AzureErrorHandler } from '../utils/azure-error-handler';

export const someController = async (req: Request, res: Response) => {
  try {
    const data = await someService();
    return res.json(data);
  } catch (err) {
    if (err instanceof AzureApiError) {
      const errorResponse = AzureErrorHandler.createErrorResponse(err);
      return res.status(err.statusCode).json(errorResponse);
    }

    const unknownError = AzureErrorHandler.handleUnknownError(err, 'someController');
    const errorResponse = AzureErrorHandler.createErrorResponse(unknownError);
    return res.status(unknownError.statusCode).json(errorResponse);
  }
};
```

### Error Response Format
All errors will return a consistent format:
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "statusCode": 401,
  "retryable": false,
  "timestamp": "2024-10-16T10:30:00.000Z"
}
```

## Error Categories

### Configuration Errors (500)
- `MISSING_CONFIG`: Required environment variables not set
- `INVALID_CONFIG`: Configuration values are invalid

### Authentication & Authorization (401, 403)
- `UNAUTHORIZED`: Invalid or expired token
- `FORBIDDEN`: Insufficient permissions
- `TOKEN_EXPIRED`: Token has expired

### Resource Errors (404)
- `NOT_FOUND`: Requested resource doesn't exist
- `RESOURCE_UNAVAILABLE`: Resource exists but not accessible

### Service Errors (429, 503)
- `RATE_LIMIT`: API rate limit exceeded (retryable)
- `SERVICE_UNAVAILABLE`: Azure DevOps service down (retryable)

### Network Errors (408, 503)
- `TIMEOUT`: Request timeout (retryable)
- `NETWORK_ERROR`: Network connectivity issues (retryable)
- `CONNECTION_ERROR`: Connection refused (retryable)

### Data Errors (502)
- `EMPTY_RESPONSE`: API returned empty response
- `INVALID_RESPONSE`: Response doesn't match expected format

## Benefits

1. **Consistency**: All Azure API errors follow the same structure
2. **Retry Logic**: Built-in retry indicators for transient failures
3. **Debugging**: Structured error information with timestamps and context
4. **Client-Friendly**: Clear error messages for frontend consumption
5. **Monitoring**: Standardized error codes for logging and alerting