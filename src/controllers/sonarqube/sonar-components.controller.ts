// src/controllers/sonarqube/area.controller.ts
import { Request, Response } from "express";
import { getComponentMetrics, getComponents } from "../../services/sonaqube/sonar-components.service";
import { Qualifiers } from "../../enums/sonarqube/qualifiers";
import { AzureApiError, AzureErrorHandler, ErrorCodes } from '../../utils/azure-error-handler.js';
import { AxiosError } from 'axios';

export async function getComponentsController(req: Request, res: Response) {
  try {
    console.log('Fetching SonarQube components:', req.query);

    // Extract and validate query parameters
    const qualifiersParam = req.query.qualifiers as string;
    const pageParam = req.query.page as string;
    const sizeParam = req.query.size as string;

    // Validate and parse qualifiers
    let qualifiers: Qualifiers[] = [Qualifiers.VW]; // Default value
    if (qualifiersParam) {
      const qualifiersList = qualifiersParam.split(",").map(q => q.trim()).filter(Boolean);
      
      // Validate qualifiers against enum values
      const validQualifiers = Object.values(Qualifiers);
      const invalidQualifiers = qualifiersList.filter(q => !validQualifiers.includes(q as Qualifiers));
      
      if (invalidQualifiers.length > 0) {
        return res.status(400).json({
          error: `Invalid qualifiers: ${invalidQualifiers.join(', ')}. Valid values are: ${validQualifiers.join(', ')}`,
          code: ErrorCodes.INVALID_REQUEST,
          timestamp: new Date().toISOString()
        });
      }

      if (qualifiersList.length > 10) {
        return res.status(400).json({
          error: 'Too many qualifiers requested. Maximum 10 allowed per request.',
          code: ErrorCodes.RESOURCE_LIMIT,
          timestamp: new Date().toISOString()
        });
      }

      qualifiers = qualifiersList as Qualifiers[];
    }

    // Validate and parse page parameter
    let page = 1; // Default value
    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (isNaN(parsedPage) || parsedPage < 1) {
        return res.status(400).json({
          error: 'Page parameter must be a positive integer starting from 1',
          code: ErrorCodes.INVALID_REQUEST,
          timestamp: new Date().toISOString()
        });
      }
      if (parsedPage > 1000) {
        return res.status(400).json({
          error: 'Page parameter cannot exceed 1000',
          code: ErrorCodes.RESOURCE_LIMIT,
          timestamp: new Date().toISOString()
        });
      }
      page = parsedPage;
    }

    // Validate and parse size parameter
    let size = 100; // Default value
    if (sizeParam) {
      const parsedSize = parseInt(sizeParam, 10);
      if (isNaN(parsedSize) || parsedSize < 1) {
        return res.status(400).json({
          error: 'Size parameter must be a positive integer',
          code: ErrorCodes.INVALID_REQUEST,
          timestamp: new Date().toISOString()
        });
      }
      if (parsedSize > 500) {
        return res.status(400).json({
          error: 'Size parameter cannot exceed 500 components per request',
          code: ErrorCodes.RESOURCE_LIMIT,
          timestamp: new Date().toISOString()
        });
      }
      size = parsedSize;
    }

    console.log(`Fetching SonarQube components with qualifiers: [${qualifiers.join(', ')}], page: ${page}, size: ${size}`);

    const result = await getComponents(qualifiers, page, size);

    // Validate result structure
    if (!result || typeof result !== 'object') {
      console.error('Invalid result structure from SonarQube components service:', result);
      return res.status(500).json({
        error: 'Invalid response from SonarQube components service',
        code: ErrorCodes.INTERNAL_ERROR,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Successfully retrieved SonarQube components: page ${page}, size ${size}, qualifiers: [${qualifiers.join(', ')}]`);

    res.json(result);

  } catch (error: any) {
    console.error('Error in getComponentsController:', error);

    // Handle SonarQube API specific errors (if using AzureApiError pattern)
    if (error instanceof AzureApiError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        retryable: error.isRetryable,
        timestamp: error.timestamp
      });
    }

    // Handle Axios errors
    if (error.isAxiosError) {
      const axiosError = error as AxiosError;
      let statusCode = 500;
      let errorMessage = 'Failed to fetch components from SonarQube';

      if (axiosError.response) {
        statusCode = axiosError.response.status;
        if (statusCode === 401) {
          errorMessage = 'Unauthorized access to SonarQube. Please check API credentials.';
        } else if (statusCode === 403) {
          errorMessage = 'Forbidden access to SonarQube. Insufficient permissions.';
        } else if (statusCode === 404) {
          errorMessage = 'SonarQube endpoint not found. Please verify the configuration.';
        } else if (statusCode >= 500) {
          errorMessage = 'SonarQube server error. Please try again later.';
        }
      } else if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        statusCode = 408;
        errorMessage = 'Request timeout. SonarQube took too long to respond.';
      } else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        statusCode = 503;
        errorMessage = 'Cannot connect to SonarQube server. Please check the server status.';
      }

      return res.status(statusCode).json({
        error: errorMessage,
        code: statusCode === 408 ? ErrorCodes.TIMEOUT : 
              statusCode === 503 ? ErrorCodes.INTERNAL_ERROR : 
              ErrorCodes.INTERNAL_ERROR,
        retryable: statusCode >= 500 || statusCode === 408,
        timestamp: new Date().toISOString()
      });
    }

    // Handle validation errors from service layer
    if (error.message && (
      error.message.includes('qualifiers') || 
      error.message.includes('page') ||
      error.message.includes('size') ||
      error.message.includes('invalid') || 
      error.message.includes('required')
    )) {
      return res.status(400).json({
        error: 'Invalid parameters provided to SonarQube service',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Handle generic errors
    return res.status(500).json({
      error: 'Failed to fetch SonarQube components. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: true,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getMetricsByComponent(req: Request, res: Response) {
  try {
    console.log('Fetching SonarQube component metrics:', req.query);

    // Extract and validate query parameters
    const componentKey = req.query.componentKey as string;

    // Comprehensive validation for componentKey
    if (!componentKey) {
      return res.status(400).json({
        error: 'componentKey parameter is required',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Validate componentKey format and length
    if (typeof componentKey !== 'string' || componentKey.trim().length === 0) {
      return res.status(400).json({
        error: 'componentKey must be a non-empty string',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (componentKey.length > 400) {
      return res.status(400).json({
        error: 'componentKey is too long. Maximum 400 characters allowed.',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Basic validation for componentKey format (SonarQube keys usually don't contain certain characters)
    const invalidChars = /[<>"|*?]/;
    if (invalidChars.test(componentKey)) {
      return res.status(400).json({
        error: 'componentKey contains invalid characters. Avoid using: < > " | * ?',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    const trimmedComponentKey = componentKey.trim();
    console.log(`Fetching metrics for SonarQube component: ${trimmedComponentKey}`);

    const result = await getComponentMetrics(trimmedComponentKey);

    // Validate result structure
    if (!result || typeof result !== 'object') {
      console.error('Invalid result structure from SonarQube metrics service:', result);
      return res.status(500).json({
        error: 'Invalid response from SonarQube metrics service',
        code: ErrorCodes.INTERNAL_ERROR,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Successfully retrieved metrics for SonarQube component: ${trimmedComponentKey}`);

    res.json(result);

  } catch (error: any) {
    console.error('Error in getMetricsByComponent:', error);

    // Handle SonarQube API specific errors (if using AzureApiError pattern)
    if (error instanceof AzureApiError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        retryable: error.isRetryable,
        timestamp: error.timestamp
      });
    }

    // Handle Axios errors
    if (error.isAxiosError) {
      const axiosError = error as AxiosError;
      let statusCode = 500;
      let errorMessage = 'Failed to fetch component metrics from SonarQube';

      if (axiosError.response) {
        statusCode = axiosError.response.status;
        if (statusCode === 401) {
          errorMessage = 'Unauthorized access to SonarQube. Please check API credentials.';
        } else if (statusCode === 403) {
          errorMessage = 'Forbidden access to SonarQube. Insufficient permissions.';
        } else if (statusCode === 404) {
          errorMessage = 'SonarQube component not found. Please verify the componentKey.';
        } else if (statusCode >= 500) {
          errorMessage = 'SonarQube server error. Please try again later.';
        }
      } else if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        statusCode = 408;
        errorMessage = 'Request timeout. SonarQube took too long to respond.';
      } else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        statusCode = 503;
        errorMessage = 'Cannot connect to SonarQube server. Please check the server status.';
      }

      return res.status(statusCode).json({
        error: errorMessage,
        code: statusCode === 408 ? ErrorCodes.TIMEOUT : 
              statusCode === 503 ? ErrorCodes.INTERNAL_ERROR : 
              statusCode === 404 ? ErrorCodes.INVALID_REQUEST :
              ErrorCodes.INTERNAL_ERROR,
        retryable: statusCode >= 500 || statusCode === 408,
        timestamp: new Date().toISOString()
      });
    }

    // Handle validation errors from service layer
    if (error.message && (
      error.message.includes('componentKey') || 
      error.message.includes('component') ||
      error.message.includes('invalid') || 
      error.message.includes('required') ||
      error.message.includes('not found')
    )) {
      return res.status(400).json({
        error: 'Invalid componentKey provided or component not found in SonarQube',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Handle generic errors
    return res.status(500).json({
      error: 'Failed to fetch SonarQube component metrics. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: true,
      timestamp: new Date().toISOString()
    });
  }
}
