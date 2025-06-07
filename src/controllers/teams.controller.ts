import { Request, Response } from 'express';
import {
  getBugDetailsFromLinks,
  getBugLeakageBreakdown,
  getSprintTestMetrics,
} from '../services/azure-teams.service';
import { getBugLeakageBySprintForClient, getBugMetricsServiceForClient } from '../factories/teams-factory';
const ADO_BACKEND_SETTINGS = process.env.ADO_BACKEND_SETTINGS || 'client-teamsettings'

export const fetchBugMetricsBySprints = async (req: Request, res: Response) => {
  try {
    const { areaPaths, numSprints } = req.query;
    const areaPathList = areaPaths ? String(areaPaths).split(',') : undefined;
    const getBugMetricsService = getBugMetricsServiceForClient(ADO_BACKEND_SETTINGS);
    const metrics = await getBugMetricsService(areaPathList!, Number(numSprints));
    return res.json(metrics);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};


export const fetchBugDetails = async (req: Request, res: Response) => {
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
};

export const fetchBugLeakage = async (req: Request, res: Response) => {
  try {
    const { areaPaths } = req.body;
    const result = await getBugLeakageBreakdown(areaPaths);
    return res.json(result);
  } catch (error) {
    console.error('Error to calculate Bug Leakage:', error);
    return res.status(500).json({ error: 'Error to calculate Bug Leakage' });
  }
};

export const fetchBugLeakageBySprint = async (req: Request, res: Response) => {
  try {
    const { areaPaths, numSprints } = req.query;
    if (!areaPaths) {
      return res.status(400).json({ error: 'Parameter "areaPaths" is required.' });
    }
    const areaPathsList = String(areaPaths).split(',').map(a => a.trim());
    const getBugLeakageService = getBugLeakageBySprintForClient(ADO_BACKEND_SETTINGS);
    const results = await getBugLeakageService(areaPathsList, Number(numSprints));
    return res.json(results);
  } catch (error) {
    console.error('Error to get Bug Leakage:', error);
    return res.status(500).json({ error: 'Internal Error to get Bug Leakage' });
  }
};

export const fetchSprintAutomationMetrics = async (req: Request, res: Response) => {
  try {
    const { areaPaths, numSprints } = req.query;
    if (!areaPaths || !numSprints) {
      return res.status(400).json({ message: "Missing required query parameters: areaPaths, numSprints" });
    }
    const areaPathsArray = String(areaPaths).split(',').map(s => s.trim());
    const nSprints = parseInt(numSprints as string, 10);
    const result = await getSprintTestMetrics(areaPathsArray, nSprints);
    return res.json(result);
  } catch (err) {
    console.error('Error fetching test metrics', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
