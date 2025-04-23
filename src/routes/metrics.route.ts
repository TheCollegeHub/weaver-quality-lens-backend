import { Router } from 'express';
import { getPassRateFromPlans, getTestPlans, getTestPlansByAreaPaths } from '../services/azure.service.js';
import { getAutomationMetricsForPlans } from '../services/azure-plans.service.js';

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
  const testPlans = req.body;

  if (!Array.isArray(testPlans) || testPlans.length === 0) {
    return res.status(400).json({ error: 'Request body must be a non-empty array of test plans' });
  }

  const isValid = testPlans.every(plan => typeof plan.id === 'number' && typeof plan.name === 'string');
  if (!isValid) {
    return res.status(400).json({ error: 'Each test plan must have an "id" (number) and "name" (string)' });
  }

  try {
    const result = await getAutomationMetricsForPlans(testPlans);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /v1/testplans/automation-metrics:', err);
    res.status(500).json({ error: 'Failed to fetch automation metrics' });
  }
});



router.get('/v1/tests/automation/pass-rate', async (req, res) => {
  const { planIds } = req.query;
  if (!planIds) {
    return res.status(400).json({ error: 'planIds is required' });
  }

  const planIdList = String(planIds).split(',').map(Number);
  const project = process.env.ADO_PROJECT!;

  try {
    const allPlans = await getTestPlans(project);
    const selectedPlans = allPlans.filter((p: { id: number; }) => planIdList.includes(p.id));

    const passRate = await getPassRateFromPlans(selectedPlans, project);
    res.json(passRate);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;