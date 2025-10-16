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

/**
 * @swagger
 * /v1/testplans:
 *   get:
 *     summary: Get test plans by area paths
 *     description: Retrieves test plans from Azure DevOps for specified area paths or teams
 *     tags: [Test Plans]
 *     parameters:
 *       - in: query
 *         name: areaPaths
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated list of area paths
 *         example: "MyProject\\Team,MyProject\\Testing"
 *     responses:
 *       200:
 *         description: Test plans successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TeamTestPlans'
 *       400:
 *         description: Bad request - areaPaths parameter is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/v1/testplans', fetchTestPlans);

/**
 * @swagger
 * /v1/testplans/automation-metrics:
 *   post:
 *     summary: Get automation metrics for test plans
 *     description: Calculates automation metrics including coverage, pass rates, and execution statistics for specified test plans
 *     tags: [Test Plans]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for new automation tracking in YYYY-MM-DD format
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for new automation tracking in YYYY-MM-DD format
 *         example: "2024-01-31"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TestPlan'
 *           example:
 *             - id: 12345
 *               name: "Sprint 15 - The Team Tests"
 *             - id: 12346
 *               name: "Sprint 15 - API Tests"
 *     responses:
 *       200:
 *         description: Automation metrics successfully calculated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AutomationMetricsResponse'
 *       400:
 *         description: Bad request - invalid test plans format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/v1/testplans/automation-metrics', automationMetrics);

/**
 * @swagger
 * /v1/testplans/new-automations:
 *   post:
 *     summary: Track new automated tests
 *     description: Counts test cases that were automated within a specified date range for given test plans
 *     tags: [Test Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plans:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/TestPlan'
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Start date for tracking in YYYY-MM-DD format
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: End date for tracking in YYYY-MM-DD format
 *           example:
 *             plans:
 *               - id: 12345
 *                 name: "Sprint 15 Tests"
 *             startDate: "2024-01-01"
 *             endDate: "2024-01-31"
 *     responses:
 *       200:
 *         description: New automation tracking completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plans:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       planId:
 *                         type: number
 *                       planName:
 *                         type: string
 *                       newAutomatedTests:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: number
 *                           links:
 *                             type: array
 *                             items:
 *                               type: string
 *                 overallNewAutomatedTests:
 *                   type: number
 *       400:
 *         description: Bad request - missing or invalid parameters
 *       500:
 *         description: Internal server error
 */
router.post('/v1/testplans/new-automations', newAutomatedTests);

/**
 * @swagger
 * /v1/testplans/suites/coverage:
 *   post:
 *     summary: Get automation coverage per test suite
 *     description: Calculates automation coverage statistics for each test suite within the specified test plans
 *     tags: [Test Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plans:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/TestPlan'
 *           example:
 *             plans:
 *               - id: 12345
 *                 name: "Sprint 15 Tests"
 *     responses:
 *       200:
 *         description: Suite coverage statistics successfully calculated
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   planId:
 *                     type: number
 *                   planName:
 *                     type: string
 *                   totalManual:
 *                     type: number
 *                   totalAutomated:
 *                     type: number
 *                   totalTests:
 *                     type: number
 *                   totalCoverage:
 *                     type: number
 *                   suites:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         suiteId:
 *                           type: number
 *                         suiteName:
 *                           type: string
 *                         manual:
 *                           type: number
 *                         automated:
 *                           type: number
 *                         total:
 *                           type: number
 *                         automationCoverage:
 *                           type: number
 *       400:
 *         description: Bad request - missing or invalid plans
 *       500:
 *         description: Internal server error
 */
router.post('/v1/testplans/suites/coverage', automationCoveragePerSuite);

/**
 * @swagger
 * /v1/testcases:
 *   get:
 *     summary: Get ready test cases by area paths
 *     description: Retrieves test cases that are ready for execution, excluding closed state, for specified area paths
 *     tags: [Test Cases]
 *     parameters:
 *       - in: query
 *         name: areaPaths
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated list of area paths
 *         example: "MyProject\\Team"
 *     responses:
 *       200:
 *         description: Test cases successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 testCases:
 *                   type: array
 *                   items:
 *                     type: object
 *                 overall:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     automated:
 *                       type: number
 *                     manual:
 *                       type: number
 *                     automationCoverage:
 *                       type: number
 *                 overallByTeam:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       areaPath:
 *                         type: string
 *                       total:
 *                         type: number
 *                       automated:
 *                         type: number
 *                       manual:
 *                         type: number
 *                       automationCoverage:
 *                         type: number
 *       400:
 *         description: Bad request - areaPaths parameter is required
 *       500:
 *         description: Internal server error
 */
router.get('/v1/testcases', fetchReadyTestCases);

/**
 * @swagger
 * /v1/testcases/usage:
 *   post:
 *     summary: Get test case usage status
 *     description: Determines which test cases have been used in recent test runs vs unused test cases
 *     tags: [Test Cases]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               testCases:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     title:
 *                       type: string
 *           example:
 *             testCases:
 *               - id: 12345
 *                 title: "Login functionality test"
 *               - id: 12346
 *                 title: "Dashboard loading test"
 *     responses:
 *       200:
 *         description: Test case usage analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 used:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       title:
 *                         type: string
 *                 unused:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       title:
 *                         type: string
 *                 overall:
 *                   type: object
 *                   properties:
 *                     totalUsed:
 *                       type: number
 *                     totalUnused:
 *                       type: number
 *                     total:
 *                       type: number
 *       400:
 *         description: Bad request - testCases array is required
 *       500:
 *         description: Internal server error
 */
router.post('/v1/testcases/usage', getTestCaseUsage);

export default router;
