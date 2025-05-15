import { Request, Response } from 'express';
import { getAllAreaPaths } from '../services/azure-organization.service';

export const getAreaPaths = async (req: Request, res: Response) => {
  try {
    const areas = await getAllAreaPaths();
    return res.json(areas);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
};