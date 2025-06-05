import { Qualifiers } from "../../enums/sonarqube/qualifiers";
import { SonarComponentsResponse } from "../../interfaces/sonaqube/sonar-components";
import { MetricsResponse } from "../../interfaces/sonaqube/sonar-measures";
import { fetchComponentMeasures, fetchComponents } from "../../repositories/sonarqube/sonar-components.repository";

export async function getComponents(qualifiers: Qualifiers[], page: number, pageSize: number): Promise<SonarComponentsResponse> {
  return await fetchComponents(qualifiers, page, pageSize);
}

export async function getComponentMetrics(componentKey: string): Promise<MetricsResponse> {
  if (!componentKey) {
    throw new Error("invalid params: componentKey are required");
  }

  return await fetchComponentMeasures(componentKey);
}
