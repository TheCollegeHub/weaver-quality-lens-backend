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
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const testPlans = req.body;

  if (!Array.isArray(testPlans) || testPlans.length === 0) {
    return res.status(400).json({ error: 'Request body must be a non-empty array of test plans' });
  }

  const isValid = testPlans.every(plan => typeof plan.id === 'number' && typeof plan.name === 'string');
  if (!isValid) {
    return res.status(400).json({ error: 'Each test plan must have an "id" (number) and "name" (string)' });
  }

  try {
    const result = await getAutomationMetricsForPlans(testPlans, startDate, endDate);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /automation-metrics:', err);
    res.status(500).json({ error: 'Failed to fetch automation metrics' });
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

    if (!Array.isArray(plans) || plans.length === 0) {
      return res.status(400).json({ message: 'Missing or invalid "plans".' });
    }

    const data = await getAutomationCoveragePerSuite(plans);
    return res.json(data);
  } catch (error: any) {
    console.error('Error in /coverage-by-suite:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

export async function fetchReadyTestCases(req: Request, res: Response) {
  const { areaPaths } = req.query;
  const areaPathList = areaPaths ? String(areaPaths).split(',').map(p => p.trim()) : undefined;

  if (!areaPathList || areaPathList.length === 0) {
    return res.status(400).json({ error: 'areaPaths is required' });
  }

  try {
    const testCases = await getReadyTestCasesByAreaPaths(areaPathList);
    res.json(testCases);
  } catch (err: any) {
    console.error('Error fetching test cases:', err);
    res.status(500).json({ error: err.message });
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
