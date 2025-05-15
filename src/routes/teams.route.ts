import { Router } from 'express';
import {
  fetchBugMetricsBySprints,
  fetchBugDetails,
  fetchBugLeakage,
  fetchBugLeakageBySprint,
  fetchSprintAutomationMetrics,
} from '../controllers/teams.controller';

const router = Router();

router.get('/v1/teams/bugs-by-sprint', fetchBugMetricsBySprints);
router.post('/v1/teams/bug-details', fetchBugDetails);
router.post('/v1/teams/bug-leakage', fetchBugLeakage);
router.get('/v1/teams/bug-leakage-sprint', fetchBugLeakageBySprint);
router.get('/v1/teams/sprints/automation-metrics', fetchSprintAutomationMetrics);

export default router;
