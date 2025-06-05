import { Qualifiers } from "../../enums/sonarqube/qualifiers";
import { sonarClient } from "../../utils/sonar-client";
const metricKeys = process.env.METRICS_KEY || 'coverage,branch_coverage,tests,test_errors,test_failures,skipped_tests,test_success_density'

export async function fetchComponents(
  qualifiers: Qualifiers[] = ["VW"] as Qualifiers[],
  page: number = 1,
  pageSize: number = 100
) {
  const qualifierQuery = qualifiers.join(",");
  const url = `/api/components/search?qualifiers=${qualifierQuery}&p=${page}&ps=${pageSize}`;

  const response = await sonarClient.get(url);
  return response.data;
}

export async function fetchComponentMeasures(componentKey: string) {
  const url = `/api/measures/component?component=${componentKey}&metricKeys=${metricKeys}`;

  const response = await sonarClient.get(url);
  return response.data;
}