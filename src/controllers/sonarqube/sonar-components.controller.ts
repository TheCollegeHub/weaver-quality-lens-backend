// src/controllers/sonarqube/area.controller.ts
import { Request, Response } from "express";
import { getComponentMetrics, getComponents } from "../../services/sonaqube/sonar-components.service";
import { Qualifiers } from "../../enums/sonarqube/qualifiers";

export async function getComponentsController(req: Request, res: Response) {
  try {
    const qualifiersParam = req.query.qualifiers as string;
    const qualifiers = qualifiersParam ? qualifiersParam.split(",") : ["VW"];

    const page = parseInt(req.query.page as string);
    const size = parseInt(req.query.size as string);

    const safePage = !isNaN(page) && page > 0 ? page : 1;
    const safeSize = !isNaN(size) && size > 0 && size <= 500 ? size : 100;

    const result = await getComponents(qualifiers as Qualifiers[], safePage, safeSize);

    res.json(result);
  } catch (error) {
    console.error("Erro ao buscar áreas:", error);
    res.status(500).json({ error: "Erro ao buscar áreas do SonarQube" });
  }
}

export async function getMetricsByComponent(req: Request, res: Response) {
  try {
    const componentKey = req.query.componentKey as string;

    if (!componentKey) {
      return res.status(400).json({ error: "params 'componentKey' is required" });
    }

    const result = await getComponentMetrics(componentKey);

    res.json(result);
  } catch (error) {
    console.error("Error to Get Measures:", error);
    res.status(500).json({ error: "Error to Get Measures from SonarQube" });
  }
}
