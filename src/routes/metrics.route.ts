import { Router } from 'express';
import redis from '../cache/redis.js';
import { filterPlansByArea, getAutomationMetrics, getBugDetailsFromLinks, getBugLeakageBreakdown, getBugLeakageBySprint, getBugMetricsBySprints, getPassRateFromPlans, getTestPlans} from '../services/azure.service.js';

const router = Router();

router.get('/v1/plans/by-area', async (req, res) => {
  const { areaPath } = req.query;

  if (!areaPath) {
    return res.status(400).json({ error: 'areaPath is required' });
  }

  try {
    const project = process.env.ADO_PROJECT;
    const cacheKey = `plans:by-area:${areaPath}`;
    const cachedPlans = await redis.get(cacheKey);
    if (cachedPlans) {
      return res.json(JSON.parse(cachedPlans));
    }

    const allPlans = await getTestPlans(project!);
    const filtered = filterPlansByArea(allPlans, [String(areaPath)]);

    const result = filtered.map((p) => ({
      id: p.id,
      name: p.name,
    }));

    await redis.set(cacheKey, JSON.stringify(result), 'EX', 600);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



router.get('/v1/tests/automation', async (req, res) => {
  const { planId, planNames, areaPaths, cache = 'true' } = req.query;

  const planNamesList = planNames ? String(planNames).split(',') : undefined;
  const areaPathList = areaPaths ? String(areaPaths).split(',') : undefined;

  const cacheKey = `metrics:automation:${planId || 'all'}:${planNamesList?.join('-') || 'none'}:${areaPathList?.join('-') || 'none'}`;

  if (cache === 'true') {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));
  }

  try {
    const result = await getAutomationMetrics(
      planId ? Number(planId) : undefined,
      areaPathList,
      planNamesList
    );

    await redis.set(cacheKey, JSON.stringify(result), 'EX', 600); // 10min

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

router.get('/v1/teams/bugs-by-sprint', async (req, res) => {
  const { areaPaths } = req.query;

  const areaPathList = areaPaths ? String(areaPaths).split(',') : undefined;

  try {
    const project = process.env.ADO_PROJECT!;
    const metrics = await getBugMetricsBySprints(project, areaPathList!);
    res.json(metrics);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/v1/teams/bug-details', async (req, res) => {
  try {
    const { links } = req.body;

    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'It is required a list of links.' });
    }

    const result = await getBugDetailsFromLinks(links);
    return res.json(result);
  } catch (error) {
    console.error('Error to get bug details', error);
    return res.status(500).json({ error: 'Error to get bug details' });
  }
});

router.post('/v1/teams/bug-leakage', async (req, res) => {
  try {
    const { areaPaths } = req.body;

    const result = await getBugLeakageBreakdown(areaPaths);
    return res.json(result);
  } catch (error) {
    console.error('Error to calculate Bug Leakage:', error);
    return res.status(500).json({ error: 'Error to calculate Bug Leakage:' });
  }
});

router.get('/v1/teams/bug-leakage-sprint', async (req, res) => {
  try {
    const areaPathsList = req.query.areaPaths as string;

    if (!areaPathsList) {
      return res.status(400).json({ error: 'Parameter "squads" is required.' });
    }

    const areaPaths = areaPathsList ? String(areaPathsList).split(',') : undefined;

    const results = await getBugLeakageBySprint(areaPaths!);

    res.json(results);
  } catch (error) {
    console.error('Error to get Bug Leakage:', error);
    res.status(500).json({ error: 'Internal Error to get Bug Leakage:' });
  }
});

export default router;
