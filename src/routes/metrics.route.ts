import { Router } from 'express';
import { countNewAutomatedInPlan, getSprintTestMetrics, getTestPlansByAreaPaths } from '../services/azure.service.js';
import { getAutomationMetricsForPlans } from '../services/azure-plans.service.js';
import { TestPlan } from '../interfaces/testplans-interface.js';
import { NewAutomatedTestsData } from '../interfaces/sprint-automation-metrics-interface.js';

const router = Router();

router.get('/v1/testplans', async (req, res) => {
  const { areaPaths } = req.query;

  const areaPathList = areaPaths ? String(areaPaths).split(',').map(p => p.trim()) : undefined;

  if (!areaPathList || areaPathList.length === 0) {
    return res.status(400).json({ error: 'areaPaths is required' });
  }

  try {
    const project = process.env.ADO_PROJECT;

    const result = await getTestPlansByAreaPaths(project!, areaPathList);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/v1/testplans/automation-metrics', async (req, res) => {
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
    console.error('Error in /v1/testplans/automation-metrics:', err);
    res.status(500).json({ error: 'Failed to fetch automation metrics' });
  }
});

router.get('/v1/teams/sprints/automation-metrics', async (req, res) => {
  try {
    const { areaPaths, numSprints } = req.query;

    if (!areaPaths || !numSprints) {
      return res.status(400).json({ message: "Missing required query parameters: areaPaths, numSprints" });
    }

    const areaPathsArray = (areaPaths as string).split(',').map(s => s.trim());
    const nSprints = parseInt(numSprints as string, 10);

    const result = await getSprintTestMetrics(areaPathsArray, nSprints);
    res.json(result);
  } catch (err) {
    console.error('Error fetching test metrics', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

interface AutomationRequestBody {
  plans: TestPlan[];
  startDate: string;
  endDate: string;
}

router.post('/v1/testplans/new-automations', async (req, res) => {
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
    console.error('Error in /v1/testplans/new-automations:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


// router.get('/v1/tests/automation/pass-rate', async (req, res) => {
//   const { planIds } = req.query;
//   if (!planIds) {
//     return res.status(400).json({ error: 'planIds is required' });
//   }

//   const planIdList = String(planIds).split(',').map(Number);
//   const project = process.env.ADO_PROJECT!;

//   try {
//     const allPlans = await getTestPlans(project);
//     const selectedPlans = allPlans.filter((p: { id: number; }) => planIdList.includes(p.id));

//     const passRate = await getPassRateFromPlans(selectedPlans, project);
//     res.json(passRate);
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

export default router;