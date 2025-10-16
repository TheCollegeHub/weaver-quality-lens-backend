import { Request, Response } from 'express';
import {
  getBugDetailsFromLinks,
  getBugLeakageBreakdown,
  getBugLeakageBySprint,
  getBugMetricsBySprints,
  getSprintTestMetrics,
} from '../services/azure-teams.service';
import { AzureApiError, AzureErrorHandler, ErrorCodes } from '../utils/azure-error-handler.js';
import { AxiosError } from 'axios';

// Comprehensive function to fix double backslash issue in area paths
const sanitizeAreaPaths = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeAreaPaths(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'areaPath' && typeof value === 'string') {
        // Replace multiple backslashes with single backslashes
        sanitized[key] = value.replace(/\\+/g, '\\');
      } else if (typeof value === 'object' || Array.isArray(value)) {
        sanitized[key] = sanitizeAreaPaths(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  
  // Handle strings that might contain area paths
  if (typeof obj === 'string' && obj.includes('\\\\')) {
    return obj.replace(/\\+/g, '\\');
  }
  
  return obj;
};

export const fetchBugMetricsBySprints = async (req: Request, res: Response) => {
  try {
    // Validate request parameters
    const { areaPaths, numSprints } = req.query;
    
    if (!areaPaths) {
      return res.status(400).json({
        error: 'areaPaths parameter is required',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (!numSprints) {
      return res.status(400).json({
        error: 'numSprints parameter is required',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Parse and validate area paths
    const areaPathList = String(areaPaths).split(',').map(p => p.trim()).filter(Boolean);
    
    if (areaPathList.length === 0) {
      return res.status(400).json({
        error: 'areaPaths must contain at least one valid area path',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Validate area path format and length
    const invalidPaths = areaPathList.filter(path => 
      path.length === 0 || 
      path.length > 255 || 
      /[<>"|*?]/.test(path) // Check for invalid characters
    );

    if (invalidPaths.length > 0) {
      return res.status(400).json({
        error: `Invalid area path format: ${invalidPaths.join(', ')}`,
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Limit the number of area paths to prevent abuse
    if (areaPathList.length > 50) {
      return res.status(400).json({
        error: 'Too many area paths requested. Maximum 50 allowed per request.',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Validate numSprints
    const sprintCount = Number(numSprints);
    
    if (isNaN(sprintCount) || !Number.isInteger(sprintCount) || sprintCount <= 0) {
      return res.status(400).json({
        error: 'numSprints must be a positive integer',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (sprintCount > 100) {
      return res.status(400).json({
        error: 'numSprints cannot exceed 100 sprints per request',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Fetching bug metrics for ${areaPathList.length} area paths and ${sprintCount} sprints`);

    const result = await getBugMetricsBySprints(areaPathList, sprintCount);
    
    const sanitizedResult = sanitizeAreaPaths(result);

    // Simple success log with area paths
    console.log(`Successfully retrieved bug metrics for area paths: [${areaPathList.join(', ')}]`);

    res.json(sanitizedResult);

  } catch (error: any) {
    console.error('Error in fetchBugMetricsBySprints:', error);

    // Handle Azure API specific errors
    if (error instanceof AzureApiError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        retryable: error.isRetryable,
        timestamp: error.timestamp
      });
    }

    // Handle Axios errors (convert to AzureApiError)
    if (error.isAxiosError) {
      const azureError = AzureErrorHandler.handleAxiosError(error as AxiosError, 'fetchBugMetricsBySprints');
      return res.status(azureError.statusCode).json({
        error: azureError.message,
        code: azureError.code,
        retryable: azureError.isRetryable,
        timestamp: azureError.timestamp
      });
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout. The bug metrics calculation took too long. Please try with fewer area paths or sprints.',
        code: ErrorCodes.TIMEOUT,
        retryable: true,
        timestamp: new Date().toISOString()
      });
    }

    // Handle validation errors from service layer
    if (error.message && (
      error.message.includes('areaPaths') || 
      error.message.includes('numSprints') ||
      error.message.includes('invalid') || 
      error.message.includes('required')
    )) {
      return res.status(400).json({
        error: 'Invalid parameters provided',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Handle memory or resource errors
    if (error.message?.includes('out of memory') || error.code === 'ENOMEM') {
      return res.status(507).json({
        error: 'Request too large. Please reduce the number of area paths or sprints.',
        code: ErrorCodes.RESOURCE_LIMIT,
        retryable: false,
        timestamp: new Date().toISOString()
      });
    }

    // Handle generic errors
    return res.status(500).json({
      error: 'Failed to fetch bug metrics. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: true,
      timestamp: new Date().toISOString()
    });
  }
};

export const fetchBugDetails = async (req: Request, res: Response) => {
  try {
    // Validate request body structure
    if (!req.body) {
      return res.status(400).json({
        error: 'Request body is required',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    const { links } = req.body;

    if (!links) {
      return res.status(400).json({
        error: 'Missing "links" property in request body',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (!Array.isArray(links)) {
      return res.status(400).json({
        error: 'Links must be an array of valid URLs',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (links.length === 0) {
      return res.status(400).json({
        error: 'Links array must contain at least one URL',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Limit the number of links to prevent abuse
    if (links.length > 100) {
      return res.status(400).json({
        error: 'Too many links requested. Maximum 100 allowed per request.',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Validate link structure and format
    const invalidLinks = links.filter((link, index) => {
      if (typeof link !== 'string' || link.trim().length === 0) {
        return true;
      }
      if (link.length > 2048) { // URL length limit
        return true;
      }
      // Basic URL validation - should contain common Azure DevOps patterns
      if (!link.includes('azure') && !link.includes('visualstudio') && !link.includes('dev.azure.com')) {
        return true;
      }
      return false;
    });

    if (invalidLinks.length > 0) {
      return res.status(400).json({
        error: 'All links must be valid non-empty strings (max 2048 chars) and appear to be Azure DevOps URLs',
        code: ErrorCodes.INVALID_REQUEST,
        invalidCount: invalidLinks.length,
        timestamp: new Date().toISOString()
      });
    }

    // Remove duplicates and trim whitespace
    const uniqueLinks = [...new Set(links.map(link => link.trim()))];

    if (uniqueLinks.length !== links.length) {
      console.log(`Removed ${links.length - uniqueLinks.length} duplicate links`);
    }

    console.log(`Fetching bug details for ${uniqueLinks.length} links`);

    const result = await getBugDetailsFromLinks(uniqueLinks);

    // Log successful response metrics
    const bugCount = Array.isArray(result) ? result.length : 
      (result && typeof result === 'object' && 'bugs' in result) ? 
      (Array.isArray((result as any).bugs) ? (result as any).bugs.length : 0) : 0;
    console.log(`Successfully retrieved details for ${bugCount} bugs`);

    res.json(result);

  } catch (error: any) {
    console.error('Error in fetchBugDetails:', error);

    // Handle Azure API specific errors
    if (error instanceof AzureApiError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        retryable: error.isRetryable,
        timestamp: error.timestamp
      });
    }

    // Handle Axios errors (convert to AzureApiError)
    if (error.isAxiosError) {
      const azureError = AzureErrorHandler.handleAxiosError(error as AxiosError, 'fetchBugDetails');
      return res.status(azureError.statusCode).json({
        error: azureError.message,
        code: azureError.code,
        retryable: azureError.isRetryable,
        timestamp: azureError.timestamp
      });
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout. The bug details retrieval took too long. Please try with fewer links.',
        code: ErrorCodes.TIMEOUT,
        retryable: true,
        timestamp: new Date().toISOString()
      });
    }

    // Handle validation errors from service layer
    if (error.message && (
      error.message.includes('links') || 
      error.message.includes('invalid') || 
      error.message.includes('required')
    )) {
      return res.status(400).json({
        error: 'Invalid links provided',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Handle memory or resource errors
    if (error.message?.includes('out of memory') || error.code === 'ENOMEM') {
      return res.status(507).json({
        error: 'Request too large. Please reduce the number of links.',
        code: ErrorCodes.RESOURCE_LIMIT,
        retryable: false,
        timestamp: new Date().toISOString()
      });
    }

    // Handle generic errors
    return res.status(500).json({
      error: 'Failed to fetch bug details. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: true,
      timestamp: new Date().toISOString()
    });
  }
};

export const fetchBugLeakage = async (req: Request, res: Response) => {
  try {
    // Validate request body structure
    if (!req.body) {
      return res.status(400).json({
        error: 'Request body is required',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    const { areaPaths } = req.body;

    if (!areaPaths) {
      return res.status(400).json({
        error: 'Missing "areaPaths" property in request body',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (!Array.isArray(areaPaths)) {
      return res.status(400).json({
        error: 'areaPaths must be an array of area path strings',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (areaPaths.length === 0) {
      return res.status(400).json({
        error: 'areaPaths array must contain at least one area path',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Limit the number of area paths to prevent abuse
    if (areaPaths.length > 50) {
      return res.status(400).json({
        error: 'Too many area paths requested. Maximum 50 allowed per request.',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Validate area path structure and format
    const invalidPaths = areaPaths.filter((path, index) => {
      if (typeof path !== 'string' || path.trim().length === 0) {
        return true;
      }
      if (path.length > 255) {
        return true;
      }
      // Check for invalid characters in area paths
      if (/[<>"|*?]/.test(path)) {
        return true;
      }
      return false;
    });

    if (invalidPaths.length > 0) {
      return res.status(400).json({
        error: 'All area paths must be valid non-empty strings (max 255 chars) without invalid characters (<>"|*?)',
        code: ErrorCodes.INVALID_REQUEST,
        invalidCount: invalidPaths.length,
        timestamp: new Date().toISOString()
      });
    }

    // Remove duplicates and trim whitespace
    const uniqueAreaPaths = [...new Set(areaPaths.map(path => path.trim()))];

    if (uniqueAreaPaths.length !== areaPaths.length) {
      console.log(`Removed ${areaPaths.length - uniqueAreaPaths.length} duplicate area paths`);
    }

    console.log(`Calculating bug leakage for ${uniqueAreaPaths.length} area paths`);

    const result = await getBugLeakageBreakdown(uniqueAreaPaths);

    // Log successful response metrics
    const leakageCount = Array.isArray(result) ? result.length : 
      (result && typeof result === 'object' && 'leakages' in result) ? 
      (Array.isArray((result as any).leakages) ? (result as any).leakages.length : 0) : 0;
    console.log(`Successfully calculated bug leakage breakdown for ${leakageCount} entries`);

    res.json(result);

  } catch (error: any) {
    console.error('Error in fetchBugLeakage:', error);

    // Handle Azure API specific errors
    if (error instanceof AzureApiError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        retryable: error.isRetryable,
        timestamp: error.timestamp
      });
    }

    // Handle Axios errors (convert to AzureApiError)
    if (error.isAxiosError) {
      const azureError = AzureErrorHandler.handleAxiosError(error as AxiosError, 'fetchBugLeakage');
      return res.status(azureError.statusCode).json({
        error: azureError.message,
        code: azureError.code,
        retryable: azureError.isRetryable,
        timestamp: azureError.timestamp
      });
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout. The bug leakage calculation took too long. Please try with fewer area paths.',
        code: ErrorCodes.TIMEOUT,
        retryable: true,
        timestamp: new Date().toISOString()
      });
    }

    // Handle validation errors from service layer
    if (error.message && (
      error.message.includes('areaPaths') || 
      error.message.includes('invalid') || 
      error.message.includes('required')
    )) {
      return res.status(400).json({
        error: 'Invalid area paths provided',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Handle memory or resource errors
    if (error.message?.includes('out of memory') || error.code === 'ENOMEM') {
      return res.status(507).json({
        error: 'Request too large. Please reduce the number of area paths.',
        code: ErrorCodes.RESOURCE_LIMIT,
        retryable: false,
        timestamp: new Date().toISOString()
      });
    }

    // Handle generic errors
    return res.status(500).json({
      error: 'Failed to calculate bug leakage. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: true,
      timestamp: new Date().toISOString()
    });
  }
};

export const fetchBugLeakageBySprint = async (req: Request, res: Response) => {
  try {
    // Validate request parameters
    const { areaPaths, numSprints } = req.query;
    
    if (!areaPaths) {
      return res.status(400).json({
        error: 'areaPaths parameter is required',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (!numSprints) {
      return res.status(400).json({
        error: 'numSprints parameter is required',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Parse and validate area paths
    const areaPathList = String(areaPaths).split(',').map(p => p.trim()).filter(Boolean);
    
    if (areaPathList.length === 0) {
      return res.status(400).json({
        error: 'areaPaths must contain at least one valid area path',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Validate area path format and length
    const invalidPaths = areaPathList.filter(path => 
      path.length === 0 || 
      path.length > 255 || 
      /[<>"|*?]/.test(path) // Check for invalid characters
    );

    if (invalidPaths.length > 0) {
      return res.status(400).json({
        error: `Invalid area path format: ${invalidPaths.join(', ')}`,
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Limit the number of area paths to prevent abuse
    if (areaPathList.length > 50) {
      return res.status(400).json({
        error: 'Too many area paths requested. Maximum 50 allowed per request.',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Validate numSprints
    const sprintCount = Number(numSprints);
    
    if (isNaN(sprintCount) || !Number.isInteger(sprintCount) || sprintCount <= 0) {
      return res.status(400).json({
        error: 'numSprints must be a positive integer',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (sprintCount > 100) {
      return res.status(400).json({
        error: 'numSprints cannot exceed 100 sprints per request',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Calculating bug leakage by sprint for ${areaPathList.length} area paths and ${sprintCount} sprints`);

    const result = await getBugLeakageBySprint(areaPathList, sprintCount);
    
    const sanitizedResult = sanitizeAreaPaths(result);

    // Log successful response metrics
    console.log(`Successfully calculated bug leakage by sprint for area paths: [${areaPathList.join(', ')}]`);

    res.json(sanitizedResult);

  } catch (error: any) {
    console.error('Error in fetchBugLeakageBySprint:', error);

    // Handle Azure API specific errors
    if (error instanceof AzureApiError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        retryable: error.isRetryable,
        timestamp: error.timestamp
      });
    }

    // Handle Axios errors (convert to AzureApiError)
    if (error.isAxiosError) {
      const azureError = AzureErrorHandler.handleAxiosError(error as AxiosError, 'fetchBugLeakageBySprint');
      return res.status(azureError.statusCode).json({
        error: azureError.message,
        code: azureError.code,
        retryable: azureError.isRetryable,
        timestamp: azureError.timestamp
      });
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout. The bug leakage calculation took too long. Please try with fewer area paths or sprints.',
        code: ErrorCodes.TIMEOUT,
        retryable: true,
        timestamp: new Date().toISOString()
      });
    }

    // Handle validation errors from service layer
    if (error.message && (
      error.message.includes('areaPaths') || 
      error.message.includes('numSprints') ||
      error.message.includes('invalid') || 
      error.message.includes('required')
    )) {
      return res.status(400).json({
        error: 'Invalid parameters provided',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Handle memory or resource errors
    if (error.message?.includes('out of memory') || error.code === 'ENOMEM') {
      return res.status(507).json({
        error: 'Request too large. Please reduce the number of area paths or sprints.',
        code: ErrorCodes.RESOURCE_LIMIT,
        retryable: false,
        timestamp: new Date().toISOString()
      });
    }

    // Handle generic errors
    return res.status(500).json({
      error: 'Failed to calculate bug leakage by sprint. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: true,
      timestamp: new Date().toISOString()
    });
  }
};

export const fetchSprintAutomationMetrics = async (req: Request, res: Response) => {
  try {
    console.log('Fetching sprint automation metrics:', req.query);
    
    const { areaPaths, numSprints } = req.query;

    if (!areaPaths) {
      return res.status(400).json({ error: 'areaPaths parameter is required' });
    }

    if (!numSprints) {
      return res.status(400).json({ error: 'numSprints parameter is required' });
    }

    const areaPathsArray = String(areaPaths).split(',').filter(s => s.length > 0);
    const nSprints = parseInt(numSprints as string, 10);

    if (isNaN(nSprints) || nSprints <= 0) {
      return res.status(400).json({ error: 'numSprints must be a positive number' });
    }

    console.log(`Fetching sprint automation metrics for ${areaPathsArray.length} area paths and ${nSprints} sprints`);

    // Sanitize area paths to fix double backslash issues
    const sanitizedAreaPaths = sanitizeAreaPaths(areaPathsArray);

    const result = await getSprintTestMetrics(sanitizedAreaPaths, nSprints);
    
    // Sanitize area paths in the response
    const sanitizedResult = sanitizeAreaPaths(result);

    console.log(`Successfully retrieved sprint automation metrics for area paths: [${sanitizedAreaPaths.join(', ')}]`);

    res.json(sanitizedResult);

  } catch (error: any) {
    console.error('Error in fetchSprintAutomationMetrics:', error);
    res.status(500).json({ error: 'Failed to fetch sprint automation metrics' });
  }
};
