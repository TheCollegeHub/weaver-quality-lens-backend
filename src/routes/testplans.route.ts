import { Router } from 'express';
import {
  fetchTestPlans,
  automationMetrics,
  newAutomatedTests,
  automationCoveragePerSuite
} from '../controllers/testplans.controller.js';

const router = Router();

router.get('/v1/testplans', fetchTestPlans);
router.post('/v1/testplans/automation-metrics', automationMetrics);
router.post('/v1/testplans/new-automations', newAutomatedTests);
router.post('/v1/testplans/suites/coverage', automationCoveragePerSuite);

export default router;
