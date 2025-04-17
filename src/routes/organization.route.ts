import { Router } from 'express';
import { getAllAreaPaths, } from '../services/azure.service.js';

const router = Router();

router.get('/v1/organization/areaPaths', async (req, res) => {
  try {
    const project = process.env.ADO_PROJECT;
    const areas = await getAllAreaPaths(project!);
    res.json(areas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
