import { Request, Response } from 'express';
import {
  getTestPlansByAreaPaths,
  getAutomationMetricsForPlans,
  countNewAutomatedInPlan,
  getAutomationCoveragePerSuite,
  getReadyTestCasesByAreaPaths,
  getTestCaseUsageStatus
} from '../services/azure-testplans.service.js';
import { AutomationRequestBody, NewAutomatedTestsData } from '../interfaces/sprint-automation-metrics-interface.js';
import { TestPlan } from '../interfaces/testplans-interface.js';
import { AzureApiError, AzureErrorHandler, ErrorCodes } from '../utils/azure-error-handler.js';
import { AxiosError } from 'axios';

export async function fetchTestPlans(req: Request, res: Response) {
  try {
    // Validate request parameters
    const { areaPaths } = req.query;
    
    if (!areaPaths) {
      return res.status(400).json({
        error: 'areaPaths parameter is required',
        code: ErrorCodes.INVALID_CONFIG,
        timestamp: new Date().toISOString()
      });
    }

    // Parse and validate area paths
    const areaPathList = String(areaPaths).split(',').map(p => p.trim()).filter(Boolean);
    
    if (areaPathList.length === 0) {
      return res.status(400).json({
        error: 'areaPaths must contain at least one valid area path',
        code: ErrorCodes.INVALID_CONFIG,
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
        code: ErrorCodes.INVALID_CONFIG,
        timestamp: new Date().toISOString()
      });
    }

    // Limit the number of area paths to prevent abuse
    if (areaPathList.length > 50) {
      return res.status(400).json({
        error: 'Too many area paths requested. Maximum 50 allowed per request.',
        code: ErrorCodes.INVALID_CONFIG,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Fetching test plans for ${areaPathList.length} area paths: ${areaPathList.join(', ')}`);

    const result = await getTestPlansByAreaPaths(areaPathList);
    
    // Log successful response metrics
    const totalPlans = result.reduce((sum, team) => sum + team.totalTestPlans, 0);
    console.log(`Successfully retrieved ${totalPlans} test plans across ${result.length} teams`);

    res.json(result);

  } catch (error: any) {
    console.error('Error in fetchTestPlans:', error);

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
      const azureError = AzureErrorHandler.handleAxiosError(error as AxiosError, 'fetchTestPlans');
      return res.status(azureError.statusCode).json({
        error: azureError.message,
        code: azureError.code,
        retryable: azureError.isRetryable,
        timestamp: azureError.timestamp
      });
    }

    // Handle validation errors from service layer
    if (error.message && error.message.includes('areaPaths are required')) {
      return res.status(400).json({
        error: 'Invalid area paths provided',
        code: ErrorCodes.INVALID_CONFIG,
        timestamp: new Date().toISOString()
      });
    }

    // Handle generic errors
    return res.status(500).json({
      error: 'Failed to fetch test plans. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    });
  }
}

export async function automationMetrics(req: Request, res: Response) {
  try {
    // Validate query parameters
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const testPlans = req.body;

    // Validate request body structure
    if (!testPlans) {
      return res.status(400).json({
        error: 'Request body is required',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (!Array.isArray(testPlans)) {
      return res.status(400).json({
        error: 'Request body must be an array of test plans',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (testPlans.length === 0) {
      return res.status(400).json({
        error: 'Request body must contain at least one test plan',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Limit the number of test plans to prevent abuse
    if (testPlans.length > 100) {
      return res.status(400).json({
        error: 'Too many test plans requested. Maximum 100 allowed per request.',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Validate test plan structure
    const invalidPlans = testPlans.filter((plan, index) => {
      if (typeof plan !== 'object' || plan === null) {
        return true;
      }
      if (typeof plan.id !== 'number' || !Number.isInteger(plan.id) || plan.id <= 0) {
        return true;
      }
      if (typeof plan.name !== 'string' || plan.name.trim().length === 0) {
        return true;
      }
      if (plan.name.length > 255) {
        return true;
      }
      return false;
    });

    if (invalidPlans.length > 0) {
      return res.status(400).json({
        error: 'Each test plan must have a valid "id" (positive integer) and "name" (non-empty string, max 255 chars)',
        code: ErrorCodes.INVALID_REQUEST,
        invalidCount: invalidPlans.length,
        timestamp: new Date().toISOString()
      });
    }

    // Validate date parameters if provided
    if (startDate || endDate) {
      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Both startDate and endDate must be provided when using date filtering',
          code: ErrorCodes.INVALID_REQUEST,
          timestamp: new Date().toISOString()
        });
      }

      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({
          error: 'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)',
          code: ErrorCodes.INVALID_REQUEST,
          timestamp: new Date().toISOString()
        });
      }

      if (isNaN(endDateObj.getTime())) {
        return res.status(400).json({
          error: 'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)',
          code: ErrorCodes.INVALID_REQUEST,
          timestamp: new Date().toISOString()
        });
      }

      if (startDateObj > endDateObj) {
        return res.status(400).json({
          error: 'startDate must be before or equal to endDate',
          code: ErrorCodes.INVALID_REQUEST,
          timestamp: new Date().toISOString()
        });
      }

      // Limit date range to prevent excessive processing
      const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
      if (endDateObj.getTime() - startDateObj.getTime() > maxRangeMs) {
        return res.status(400).json({
          error: 'Date range cannot exceed 365 days',
          code: ErrorCodes.INVALID_REQUEST,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Remove duplicates based on ID
    const uniquePlans = testPlans.filter((plan, index, arr) => 
      arr.findIndex(p => p.id === plan.id) === index
    );

    if (uniquePlans.length !== testPlans.length) {
      console.log(`Removed ${testPlans.length - uniquePlans.length} duplicate test plans`);
    }

    console.log(`Processing automation metrics for ${uniquePlans.length} test plans${startDate && endDate ? ` with date range ${startDate} to ${endDate}` : ''}`);

    const result = await getAutomationMetricsForPlans(uniquePlans, startDate, endDate);
    
    // Log successful response metrics
    console.log(`Successfully calculated automation metrics: ${result.overall.total} total test cases, ${result.overall.automationCoverage}% automation coverage`);

    res.json(result);

  } catch (error: any) {
    console.error('Error in automationMetrics:', error);

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
      const azureError = AzureErrorHandler.handleAxiosError(error as AxiosError, 'automationMetrics');
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
        error: 'Request timeout. The automation metrics calculation took too long. Please try with fewer test plans or a smaller date range.',
        code: ErrorCodes.TIMEOUT,
        retryable: true,
        timestamp: new Date().toISOString()
      });
    }

    // Handle validation errors from service layer
    if (error.message && (
      error.message.includes('testPlans') || 
      error.message.includes('invalid') || 
      error.message.includes('required')
    )) {
      return res.status(400).json({
        error: 'Invalid test plans data provided',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Handle memory or resource errors
    if (error.message?.includes('out of memory') || error.code === 'ENOMEM') {
      return res.status(507).json({
        error: 'Request too large. Please reduce the number of test plans or date range.',
        code: ErrorCodes.RESOURCE_LIMIT,
        retryable: false,
        timestamp: new Date().toISOString()
      });
    }

    // Handle generic errors
    return res.status(500).json({
      error: 'Failed to calculate automation metrics. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: true,
      timestamp: new Date().toISOString()
    });
  }
}

export async function newAutomatedTests(req: Request, res: Response) {
  try {
    const { plans, startDate, endDate }: AutomationRequestBody = req.body;

    if (!Array.isArray(plans) || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing or invalid "plans", "startDate", or "endDate".' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format.' });
    }

    let overall = 0;

    const results = await Promise.all(
      plans.map(async (plan) => {
        const newAutomated: NewAutomatedTestsData = await countNewAutomatedInPlan(plan.id, start, end);
        overall += newAutomated.count;

        return {
          planId: plan.id,
          planName: plan.name,
          newAutomatedTests: newAutomated
        };
      })
    );

    return res.json({
      plans: results,
      overallNewAutomatedTests: overall
    });
  } catch (error: any) {
    console.error('Error in /new-automations:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

export async function automationCoveragePerSuite(req: Request, res: Response) {
  try {
    const { plans }: { plans: TestPlan[] } = req.body;

    // Validate request body structure
    if (!req.body) {
      return res.status(400).json({
        error: 'Request body is required',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (!plans) {
      return res.status(400).json({
        error: 'Missing "plans" property in request body',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (!Array.isArray(plans)) {
      return res.status(400).json({
        error: 'Plans must be an array of test plans',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    if (plans.length === 0) {
      return res.status(400).json({
        error: 'Plans array must contain at least one test plan',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Limit the number of test plans to prevent abuse
    if (plans.length > 100) {
      return res.status(400).json({
        error: 'Too many test plans requested. Maximum 100 allowed per request.',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Validate test plan structure
    const invalidPlans = plans.filter((plan, index) => {
      if (typeof plan !== 'object' || plan === null) {
        return true;
      }
      if (typeof plan.id !== 'number' || !Number.isInteger(plan.id) || plan.id <= 0) {
        return true;
      }
      if (typeof plan.name !== 'string' || plan.name.trim().length === 0) {
        return true;
      }
      if (plan.name.length > 255) {
        return true;
      }
      return false;
    });

    if (invalidPlans.length > 0) {
      return res.status(400).json({
        error: 'Each test plan must have a valid "id" (positive integer) and "name" (non-empty string, max 255 chars)',
        code: ErrorCodes.INVALID_REQUEST,
        invalidCount: invalidPlans.length,
        timestamp: new Date().toISOString()
      });
    }

    // Remove duplicates based on ID
    const uniquePlans = plans.filter((plan, index, arr) => 
      arr.findIndex(p => p.id === plan.id) === index
    );

    if (uniquePlans.length !== plans.length) {
      console.log(`Removed ${plans.length - uniquePlans.length} duplicate test plans`);
    }

    console.log(`Processing automation coverage per suite for ${uniquePlans.length} test plans`);

    const result = await getAutomationCoveragePerSuite(uniquePlans);
    
    // Log successful response metrics
    const totalSuites = result.reduce((sum, plan) => sum + plan.suites.length, 0);
    console.log(`Successfully calculated automation coverage for ${totalSuites} test suites across ${result.length} test plans`);

    res.json(result);

  } catch (error: any) {
    console.error('Error in automationCoveragePerSuite:', error);

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
      const azureError = AzureErrorHandler.handleAxiosError(error as AxiosError, 'automationCoveragePerSuite');
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
        error: 'Request timeout. The automation coverage calculation took too long. Please try with fewer test plans.',
        code: ErrorCodes.TIMEOUT,
        retryable: true,
        timestamp: new Date().toISOString()
      });
    }

    // Handle validation errors from service layer
    if (error.message && (
      error.message.includes('plans') || 
      error.message.includes('invalid') || 
      error.message.includes('required')
    )) {
      return res.status(400).json({
        error: 'Invalid test plans data provided',
        code: ErrorCodes.INVALID_REQUEST,
        timestamp: new Date().toISOString()
      });
    }

    // Handle memory or resource errors
    if (error.message?.includes('out of memory') || error.code === 'ENOMEM') {
      return res.status(507).json({
        error: 'Request too large. Please reduce the number of test plans.',
        code: ErrorCodes.RESOURCE_LIMIT,
        retryable: false,
        timestamp: new Date().toISOString()
      });
    }

    // Handle generic errors
    return res.status(500).json({
      error: 'Failed to calculate automation coverage per suite. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: true,
      timestamp: new Date().toISOString()
    });
  }
}

export async function fetchReadyTestCases(req: Request, res: Response) {
  try {
    // Validate request parameters
    const { areaPaths } = req.query;
    
    if (!areaPaths) {
      return res.status(400).json({
        error: 'areaPaths parameter is required',
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

    console.log(`Fetching ready test cases for ${areaPathList.length} area paths: ${areaPathList.join(', ')}`);

    const result = await getReadyTestCasesByAreaPaths(areaPathList);
    
    // Log successful response metrics
    const totalTestCases = Array.isArray(result) ? result.length : 
      (result && typeof result === 'object' && 'testCases' in result) ? 
      (Array.isArray(result.testCases) ? result.testCases.length : 0) : 0;
    console.log(`Successfully retrieved ${totalTestCases} ready test cases`);

    res.json(result);

  } catch (error: any) {
    console.error('Error in fetchReadyTestCases:', error);

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
      const azureError = AzureErrorHandler.handleAxiosError(error as AxiosError, 'fetchReadyTestCases');
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
        error: 'Request timeout. The test case retrieval took too long. Please try with fewer area paths.',
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
      error: 'Failed to fetch ready test cases. Please try again later.',
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: true,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getTestCaseUsage(req: Request, res: Response) {
  const testCases = req.body.testCases;

  if (!Array.isArray(testCases) || testCases.length === 0) {
    return res.status(400).json({ error: 'Body must contain a non-empty array of testCases with id and title.' });
  }

  console.log(testCases)
  try {
    const result = await getTestCaseUsageStatus(testCases);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
