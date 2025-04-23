import { Router } from 'express';
import { getBugDetailsFromLinks, getBugLeakageBreakdown, getBugLeakageBySprint, getBugMetricsBySprints, getPassRateFromPlans, getTestPlans} from '../services/azure.service.js';

const router = Router();

router.get('/v1/teams/bugs-by-sprint', async (req, res) => {
  const { areaPaths, numSprints} = req.query;

  const areaPathList = areaPaths ? String(areaPaths).split(',') : undefined;

  try {
    const project = process.env.ADO_PROJECT!;
    const metrics = await getBugMetricsBySprints(project, areaPathList!, Number(numSprints));
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

    const { areaPaths, numSprints} = req.query;

    if (!areaPaths) {
      return res.status(400).json({ error: 'Parameter "squads" is required.' });
    }

    const areaPathsList = areaPaths ? String(areaPaths).split(',') : undefined;

    const results = await getBugLeakageBySprint(areaPathsList!, Number(numSprints));

    res.json(results);
  } catch (error) {
    console.error('Error to get Bug Leakage:', error);
    res.status(500).json({ error: 'Internal Error to get Bug Leakage:' });
  }
});

export default router;
