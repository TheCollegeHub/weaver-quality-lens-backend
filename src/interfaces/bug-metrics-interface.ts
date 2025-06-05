import { SprintBugReport } from "../types/bug-metric-types";

export interface BugMetricsStrategy {
  getBugMetricsBySprints(areaPaths: string[], numSprints: number): Promise<SprintBugReport>;
}