import { SprintBugReport } from "../types/bug-metric-types";
import { BugLeakageBySprintResult } from "../types/leak-types";

export interface GetBugMetricsBySprints {
  (areaPaths: string[], numSprints: number): Promise<SprintBugReport>;
}

export interface GetBugLeakageBySprint {
  (areaPaths: string[], numSprints: number): Promise<BugLeakageBySprintResult>;
}