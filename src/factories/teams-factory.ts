import { getBugMetricsBySprints, getBugMetricsBySprintsV2 } from "../services/azure-teams.service";

// Você pode extrair isso de um banco, feature flag ou env
const clientServiceMap: Record<string, 'v1' | 'v2'> = {
  'client-teamsettings': 'v1',
  'client-classification': 'v2',
};

export function getBugMetricsServiceForClient(clientId: string) {
  const version = clientServiceMap[clientId] || 'v1';

  switch (version) {
    case 'v2':
      return getBugMetricsBySprintsV2;
    case 'v1':
    default:
      return getBugMetricsBySprints;
  }
}
