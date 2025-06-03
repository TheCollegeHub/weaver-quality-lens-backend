import { Router } from 'express';
import {
  fetchTestPlans,
  automationMetrics,
  newAutomatedTests,
  automationCoveragePerSuite,
  fetchReadyTestCases,
  getTestCaseUsage,
} from '../controllers/testplans.controller.js';

const router = Router();

router.get('/v1/testplans', fetchTestPlans);
router.post('/v1/testplans/automation-metrics', automationMetrics);
router.post('/v1/testplans/new-automations', newAutomatedTests);
router.post('/v1/testplans/suites/coverage', automationCoveragePerSuite);
router.get('/v1/testcases', fetchReadyTestCases);
router.post('/v1/testcases/usage', getTestCaseUsage);

export default router;
