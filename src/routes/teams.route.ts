import { Router } from 'express';
import {
  fetchBugMetricsBySprints,
  fetchBugDetails,
  fetchBugLeakage,
  fetchBugLeakageBySprint,
  fetchSprintAutomationMetrics,
} from '../controllers/teams.controller';

const router = Router();

/**
 * @swagger
 * /v1/teams/bugs-by-sprint:
 *   get:
 *     summary: Get bug metrics by sprints for teams
 *     description: Retrieves comprehensive bug metrics including opened/closed bugs and aging statistics across multiple sprints for specified teams
 *     tags: [Teams - Bug Metrics]
 *     parameters:
 *       - in: query
 *         name: areaPaths
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated list of area paths or teams
 *         example: "MyProject\\Team,MyProject\\Testing"
 *       - in: query
 *         name: numSprints
 *         required: true
 *         schema:
 *           type: number
 *         description: Number of past sprints to analyze
 *         example: 5
 *     responses:
 *       200:
 *         description: Bug metrics successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       areaPath:
 *                         type: string
 *                       sprints:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             sprint:
 *                               $ref: '#/components/schemas/SprintData'
 *                             openAndClosedBugMetric:
 *                               $ref: '#/components/schemas/BugMetric'
 *                             bugAging:
 *                               $ref: '#/components/schemas/BugAging'
 *                 sprintOveralls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sprint:
 *                         $ref: '#/components/schemas/SprintData'
 *                       openAndClosedBugMetric:
 *                         $ref: '#/components/schemas/BugMetric'
 *                       bugAging:
 *                         $ref: '#/components/schemas/BugAging'
 *                 overall:
 *                   type: object
 *                   properties:
 *                     openAndClosedBugMetric:
 *                       $ref: '#/components/schemas/BugMetric'
 *                     bugAging:
 *                       $ref: '#/components/schemas/BugAging'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/v1/teams/bugs-by-sprint', fetchBugMetricsBySprints);

/**
 * @swagger
 * /v1/teams/bug-details:
 *   post:
 *     summary: Get detailed information about specific bugs
 *     description: Retrieves detailed information about bugs from their Azure DevOps links, including title, severity, and aging information
 *     tags: [Teams - Bug Metrics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               links:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Azure DevOps bug links
 *           example:
 *             links:
 *               - "https://dev.azure.com/org/project/_workitems/edit/12345"
 *               - "https://dev.azure.com/org/project/_workitems/edit/12346"
 *     responses:
 *       200:
 *         description: Bug details successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: number
 *                   link:
 *                     type: string
 *                   title:
 *                     type: string
 *                   severity:
 *                     type: string
 *                   agingInDays:
 *                     type: number
 *       400:
 *         description: Bad request - links array is required
 *       500:
 *         description: Internal server error
 */
router.post('/v1/teams/bug-details', fetchBugDetails);

/**
 * @swagger
 * /v1/teams/bug-leakage:
 *   post:
 *     summary: Get bug leakage breakdown by environment
 *     description: Analyzes bug leakage patterns across different environments comparing production vs pre-production for multiple time ranges
 *     tags: [Teams - Bug Metrics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               areaPaths:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of area paths or teams to analyze
 *           example:
 *             areaPaths:
 *               - "MyProject\\Team"
 *               - "MyProject\\Testing"
 *     responses:
 *       200:
 *         description: Bug leakage analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       areaPath:
 *                         type: string
 *                       timeRange:
 *                         type: string
 *                         example: "30d"
 *                       bugLeakagePct:
 *                         type: string
 *                         example: "25.50%"
 *                       environments:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             environment:
 *                               type: string
 *                             total:
 *                               type: number
 *                             severities:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   severity:
 *                                     type: string
 *                                   total:
 *                                     type: number
 *                 overall:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timeRange:
 *                         type: string
 *                       bugLeakagePct:
 *                         type: string
 *                       environments:
 *                         type: array
 *       500:
 *         description: Internal server error
 */
router.post('/v1/teams/bug-leakage', fetchBugLeakage);

/**
 * @swagger
 * /v1/teams/bug-leakage-sprint:
 *   get:
 *     summary: Get bug leakage by sprint
 *     description: Analyzes bug leakage patterns per sprint, categorizing bugs by environment and severity
 *     tags: [Teams - Bug Metrics]
 *     parameters:
 *       - in: query
 *         name: areaPaths
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated list of area paths
 *         example: "MyProject\\Team"
 *       - in: query
 *         name: numSprints
 *         required: true
 *         schema:
 *           type: number
 *         description: Number of recent sprints to analyze
 *         example: 5
 *     responses:
 *       200:
 *         description: Sprint bug leakage analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       areaPath:
 *                         type: string
 *                       sprint:
 *                         type: string
 *                       totalBugs:
 *                         type: number
 *                       bugLeakagePct:
 *                         type: string
 *                       environments:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             environment:
 *                               type: string
 *                             total:
 *                               type: number
 *                             severities:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   severity:
 *                                     type: string
 *                                   total:
 *                                     type: number
 *                 sprintOverall:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sprint:
 *                         type: string
 *                       totalBugs:
 *                         type: number
 *                       prod:
 *                         type: number
 *                       preProd:
 *                         type: number
 *                       bugLeakagePct:
 *                         type: string
 *                       environments:
 *                         type: array
 *                 overall:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       environment:
 *                         type: string
 *                       total:
 *                         type: number
 *                       severities:
 *                         type: array
 *                 overallSeverity:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     severities:
 *                       type: array
 *                     distributionByEnv:
 *                       type: array
 *       400:
 *         description: Bad request - areaPaths parameter is required
 *       500:
 *         description: Internal server error
 */
router.get('/v1/teams/bug-leakage-sprint', fetchBugLeakageBySprint);

/**
 * @swagger
 * /v1/teams/sprints/automation-metrics:
 *   get:
 *     summary: Get sprint automation metrics for teams
 *     description: Retrieves test plan automation metrics aggregated by sprints for specified teams, including execution coverage and pass rates
 *     tags: [Teams - Automation Metrics]
 *     parameters:
 *       - in: query
 *         name: areaPaths
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated list of area paths
 *         example: "MyProject\\Team"
 *       - in: query
 *         name: numSprints
 *         required: true
 *         schema:
 *           type: number
 *         description: Number of sprints to analyze
 *         example: 5
 *     responses:
 *       200:
 *         description: Sprint automation metrics successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       areaPath:
 *                         type: string
 *                       sprints:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             sprintName:
 *                               type: string
 *                             planName:
 *                               type: string
 *                             totalTestCases:
 *                               type: number
 *                             totalTestCasesBeExecuted:
 *                               type: number
 *                             totalTestCasesExecuted:
 *                               type: number
 *                             totalTestCasesNotExecuted:
 *                               type: number
 *                             passRate:
 *                               type: number
 *                             executionCoverage:
 *                               type: number
 *                             manualTests:
 *                               type: number
 *                             automatedTests:
 *                               type: number
 *                 sprintsOverall:
 *                   type: array
 *                   items:
 *                     type: object
 *                 overall:
 *                   type: object
 *       400:
 *         description: Bad request - missing required parameters
 *       500:
 *         description: Internal server error
 */
router.get('/v1/teams/sprints/automation-metrics', fetchSprintAutomationMetrics);

export default router;
