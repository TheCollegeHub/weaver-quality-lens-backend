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

export async function fetchTestPlans(req: Request, res: Response) {
  const { areaPaths } = req.query;
  const areaPathList = areaPaths ? String(areaPaths).split(',').map(p => p.trim()) : undefined;

  if (!areaPathList || areaPathList.length === 0) {
    return res.status(400).json({ error: 'areaPaths is required' });
  }

  try {
    const project = process.env.ADO_PROJECT!;
    const result = await getTestPlansByAreaPaths(areaPathList);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
