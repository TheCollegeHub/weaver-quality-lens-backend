import { GetBugLeakageBySprint, GetBugMetricsBySprints } from "../interfaces/azure-teams-interface";
import { getBugLeakageBySprint, getBugLeakageBySprintByAreaPaths, getBugMetricsBySprints, getBugMetricsBySprintsByAreaPaths } from "../services/azure-teams.service";

const clientServiceBugMetricsMap: Record<string, GetBugMetricsBySprints> = {
  'client-teamsettings': getBugMetricsBySprints,
  'client-classification': getBugMetricsBySprintsByAreaPaths,
};

const clientServiceBugLeakageMetricsMap: Record<string, GetBugLeakageBySprint> = {
  'client-teamsettings': getBugLeakageBySprint,
  'client-classification': getBugLeakageBySprintByAreaPaths,
};


export function getBugMetricsServiceForClient(clientId: string): GetBugMetricsBySprints {
  return clientServiceBugMetricsMap[clientId] || getBugMetricsBySprints;
}

export function getBugLeakageBySprintForClient(clientId: string): GetBugLeakageBySprint {
  return clientServiceBugLeakageMetricsMap[clientId] || getBugLeakageBySprint;
}

