import { azureClient } from '../utils/azureClient.js';
import dayjs from 'dayjs';

export async function getAllAreaPaths(project: string) {
  const paths: any = [];

  async function fetchAreas(path = '') {
    const url = `/${project}/_apis/wit/classificationnodes/areas${path}?$depth=10&api-version=7.1-preview.2`;
    const res = await azureClient.get(url);
    const node = res.data;

    function traverse(node: { name: any; identifier: any; children: any; }, parentPath = '') {
      const fullPath = parentPath ? `${parentPath}\\${node.name}` : node.name;
      paths.push({ id: node.identifier || fullPath, name: fullPath });

      if (node.children) {
        for (const child of node.children) {
          traverse(child, fullPath);
        }
      }
    }

    traverse(node);
  }

  await fetchAreas();
  return paths;
}

import redis from '../cache/redis.js';

export async function getTestPlans(project: string) {
  const cacheKey = `plans:${project}`;

  const cachedPlans = await redis.get(cacheKey);
  if (cachedPlans) {
    console.log('Fetching Test Plans from cache...');
    return JSON.parse(cachedPlans); 
  }

  const allPlans: any[] = [];
  let continuationToken: string | undefined = undefined;

  try {

    do {
      const url: string = `/${project}/_apis/testplan/plans?api-version=7.1` + 
                  (continuationToken ? `&continuationToken=${continuationToken}` : '');

      const res = await azureClient.get(url);
      const data = res.data;

      allPlans.push(...(data.value || []));
      continuationToken = res.headers['x-ms-continuationtoken'];
    } while (continuationToken);

    console.log(`Total Plans: ${allPlans.length}`);

    await redis.set(cacheKey, JSON.stringify(allPlans), 'EX', 600); // Cache por 10 minutos

    return allPlans;
  } catch (err) {
    console.error('Error to get Test Plans:', err);
    throw err;
  }
}


export async function getSuites(project: string, planId: number) {
  const res = await azureClient.get(`/${project}/_apis/testplan/plans/${planId}/suites?api-version=${process.env.AZURE_API_VERSION}`);
  return res.data.value || [];
}

export async function getTestCases(project: string, planId: number, suiteId: number) {
  const res = await azureClient.get(`/${project}/_apis/test/plans/${planId}/suites/${suiteId}/testcases?api-version=${process.env.AZURE_API_VERSION}`);
  return res.data.value || [];
}

export const getWorkItemById = async (workItemId: string) => {
  try {
      const res = await azureClient.get(`/_apis/wit/workitems?ids=${workItemId}&$expand=all&api-version=${process.env.AZURE_API_VERSION}`);
      console.log(`WorkItem ${workItemId} get successfully.`);
      return res.data.value;
  } catch (error: any) {
      console.error(`Failed to get Work Item ${workItemId}`, error.response?.data || error.message);
      throw new Error(`Error getting Work Item: ${error.message}`);
  }
};

export function filterPlansByArea(plans: any[], areaPaths?: string[]) {
  if (areaPaths) {
    const areas = areaPaths.map(p => p.trim().toLowerCase());
    return plans.filter(p => areas.includes(p.areaPath?.toLowerCase()));
  }

  return plans;
}

export async function getAutomationMetrics(
  planId?: number,
  areaPaths?: string[],
  planNames?: string[]
): Promise<any> {
  const project = process.env.ADO_PROJECT!;
  const allPlans = await getTestPlans(project);

  let plans = [];

  if (planId) {
    plans = allPlans.filter((plan: { id: number; }) => plan.id === planId);
  } else if (planNames && planNames.length > 0) {
    plans = allPlans.filter((plan: { name: string; }) => planNames.includes(plan.name));
  } else {
    plans = filterPlansByArea(allPlans, areaPaths);
  }

  let manual = 0,
    automated = 0;

  for (const plan of plans) {
    const suites = await getSuites(project, plan.id);
    for (const suite of suites) {
      const cases = await getTestCases(project, plan.id, suite.id);
      for (const tc of cases) {
        const testcasedetails = await getWorkItemById(tc.testCase.id);
        const status = testcasedetails[0].fields['Microsoft.VSTS.TCM.AutomationStatus'];
        if (status === 'Automated') automated++;
        else manual++;
      }
    }
  }

  return {
    manual,
    automated,
    total: manual + automated,
    project,
    areaPaths,
    plansChecked: plans.map((p: { name: string; }) => p.name),
  };
}

export async function getPassRateFromPlans(plans: any[], project: string) {
  const allResults = [];
  for (const plan of plans) {
    const url = `/${project}/_apis/testplan/plans/${plan.id}/suites?api-version=${process.env.AZURE_API_VERSION}`;
    const suitesRes = await azureClient.get(url);
    const suites = suitesRes.data.value;

    for (const suite of suites) {
      const pointsUrl = `/${project}/_apis/test/plans/${plan.id}/suites/${suite.id}/points?api-version=${process.env.AZURE_API_VERSION}`;
      const pointsRes = await azureClient.get(pointsUrl);
      const points = pointsRes.data.value;
      allResults.push(...points.map((p: { outcome: any; testCase: { id: any; }; }) => ({
        outcome: p.outcome,
        testCaseId: p.testCase.id
      })));
    }
  }

  const total = allResults.length;
  const passed = allResults.filter(p => p.outcome === 'Passed').length;

  return {
    total,
    passed,
    passRate: total > 0 ? (passed / total * 100).toFixed(2) : '0.00'
  };
}

type TeamBugMetrics = {
  areaPath: string;
  path: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  opened: {
    total: number;
    bugLinks: string[];
  };
  closed: {
    total: number;
    bugLinks: string[];
  };
  stillOpen: string;
  bugAging: {
    averageDays: string | null;
    agingAboveThresholdLinks: string[];
    bugAgingBySeverity: {
      severity: string;
      count: number;
      averageDays: string;
    }[];
  };
};

type SprintBugReport = {
  teamsBugs: TeamBugMetrics[];
  overall: {
    opened: number;
    closed: number;
    stillOpen: string;
    bugAging: {
      averageDays: string | null;
      agingAboveThresholdLinks: string[];
      bugAgingBySeverity: {
        severity: string;
        count: number;
        averageDays: string;
      }[];
    };
  };
};


export async function getBugMetricsBySprints(project: string, areaPaths?: string[]): Promise<SprintBugReport> {
  const org = process.env.AZURE_ORG_NAME;
  const apiVersion = process.env.AZURE_API_VERSION;
  const iterationsUrl = `/${project}/_apis/work/teamsettings/iterations?api-version=${apiVersion}`;
  const { data } = await azureClient.get(iterationsUrl);

  const pastSprints = data.value
    .filter((s: any) =>
      s.attributes?.startDate &&
      s.attributes?.finishDate &&
      s.attributes.timeFrame === 'past'
    )
    .sort((a: any, b: any) =>
      new Date(b.attributes.startDate).getTime() - new Date(a.attributes.startDate).getTime()
    )
    .slice(0, 2);

  const teamsBugs: TeamBugMetrics[] = [];
  let totalOpened = 0;
  let totalClosed = 0;
  let totalOpenedLinks: string[] = [];
  let totalClosedLinks: string[] = [];
  let totalAgingDays = 0;
  let totalClosedForAging = 0;
  let overallAgingAboveThresholdLinks: string[] = [];
  const overallAgingBySeverity: Record<string, { count: number; totalDays: number }> = {};

  for (const sprint of pastSprints) {
    const { startDate, finishDate } = sprint.attributes;
    const start = new Date(startDate);
    const end = new Date(finishDate);
    end.setHours(23, 59, 59, 999);

    if (!areaPaths?.length) break;

    for (const areaPath of areaPaths) {
      const wiqlQuery = {
        query: `
          SELECT [System.Id]
          FROM WorkItems
          WHERE 
            [System.TeamProject] = '${decodeURIComponent(project)}'
            AND [System.WorkItemType] = 'Bug'
            AND [System.AreaPath] UNDER '${areaPath}'
            AND [System.IterationPath] UNDER '${sprint.path}'
        `
      };

      const res = await azureClient.post(`/${project}/_apis/wit/wiql?api-version=${apiVersion}`, wiqlQuery);
      const ids = res.data.workItems.map((w: any) => w.id);

      const openedIds: number[] = [];
      const closedIds: number[] = [];
      let sprintAgingTotal = 0;
      let sprintClosedCount = 0;
      const agingAboveThresholdLinks: string[] = [];
      const sprintAgingBySeverity: Record<string, { count: number; totalDays: number }> = {};

      if (ids.length) {
        const batches = [];
        const batchSize = 200;
        for (let i = 0; i < ids.length; i += batchSize) {
          batches.push(ids.slice(i, i + batchSize));
        }

        for (const batch of batches) {
          const detailRes = await azureClient.post(`/_apis/wit/workitemsbatch?api-version=7.1`, {
            ids: batch,
            fields: [
              'System.State',
              'System.CreatedDate',
              'Microsoft.VSTS.Common.ClosedDate',
              'Microsoft.VSTS.Common.Severity'
            ]
          });

          for (const item of detailRes.data.value) {
            const created = new Date(item.fields['System.CreatedDate']);
            const closed = item.fields['Microsoft.VSTS.Common.ClosedDate']
              ? new Date(item.fields['Microsoft.VSTS.Common.ClosedDate'])
              : null;

            const severity = item.fields['Microsoft.VSTS.Common.Severity'] || 'Unknown';

            const createdInSprint = created >= start && created <= end;
            const closedInSprint = closed && closed >= start && closed <= end;

            if (createdInSprint) {
              openedIds.push(item.id);
            }

            if (closedInSprint) {
              closedIds.push(item.id);

              const agingDays = Math.ceil((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
              sprintAgingTotal += agingDays;
              sprintClosedCount++;
              totalAgingDays += agingDays;
              totalClosedForAging++;

              if (!sprintAgingBySeverity[severity]) {
                sprintAgingBySeverity[severity] = { count: 0, totalDays: 0 };
              }
              sprintAgingBySeverity[severity].count++;
              sprintAgingBySeverity[severity].totalDays += agingDays;

              if (!overallAgingBySeverity[severity]) {
                overallAgingBySeverity[severity] = { count: 0, totalDays: 0 };
              }
              overallAgingBySeverity[severity].count++;
              overallAgingBySeverity[severity].totalDays += agingDays;

              if (agingDays > 7) {
                const link = `https://dev.azure.com/${process.env.ADO_ORGANIZATION}/${project}/_workitems/edit/${item.id}`;
                agingAboveThresholdLinks.push(link);
                overallAgingAboveThresholdLinks.push(link);
              }
            }
          }
        }
      }

      const bugLink = (id: number) =>
        `https://dev.azure.com/${process.env.ADO_ORGANIZATION}/${project}/_workitems/edit/${id}`;

      const openedLinks = openedIds.map(bugLink);
      const closedLinks = closedIds.map(bugLink);

      totalOpened += openedIds.length;
      totalClosed += closedIds.length;
      totalOpenedLinks.push(...openedLinks);
      totalClosedLinks.push(...closedLinks);

      const stillOpenRaw = openedIds.length === 0
        ? 0
        : ((openedIds.length - closedIds.length) / openedIds.length) * 100;

      const stillOpenPct = `${Math.max(0, stillOpenRaw).toFixed(2)}%`;

      const bugAgingBySeverityArray = Object.entries(sprintAgingBySeverity)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([severity, data]) => ({
          severity,
          count: data.count,
          averageDays: (data.totalDays / data.count).toFixed(2)
        }));

      teamsBugs.push({
        areaPath,
        path: sprint.path,
        sprintName: sprint.name,
        startDate,
        endDate: finishDate,
        opened: {
          total: openedIds.length,
          bugLinks: openedLinks
        },
        closed: {
          total: closedIds.length,
          bugLinks: closedLinks
        },
        stillOpen: stillOpenPct,
        bugAging: {
          averageDays: sprintClosedCount === 0 ? null : (sprintAgingTotal / sprintClosedCount).toFixed(2),
          agingAboveThresholdLinks,
          bugAgingBySeverity: bugAgingBySeverityArray
        }
      });
    }
  }

  const overallStillOpenRaw = totalOpened === 0
    ? 0
    : ((totalOpened - totalClosed) / totalOpened) * 100;

  const overallStillOpenPct = `${Math.max(0, overallStillOpenRaw).toFixed(2)}%`;

  const overallAgingBySeverityArray = Object.entries(overallAgingBySeverity)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([severity, data]) => ({
      severity,
      count: data.count,
      averageDays: (data.totalDays / data.count).toFixed(2)
    }));

  return {
    teamsBugs,
    overall: {
      opened: totalOpened,
      closed: totalClosed,
      stillOpen: overallStillOpenPct,
      bugAging: {
        averageDays: totalClosedForAging === 0 ? null : (totalAgingDays / totalClosedForAging).toFixed(2),
        agingAboveThresholdLinks: overallAgingAboveThresholdLinks,
        bugAgingBySeverity: overallAgingBySeverityArray
      }
    }
  };
}



export async function getBugDetailsFromLinks(links: string[]) {
  const apiVersion = process.env.AZURE_API_VERSION;

  const bugIds = links.map(link => {
    const match = link.match(/\/edit\/(\d+)/);
    return match ? Number(match[1]) : null;
  }).filter((id): id is number => id !== null);

  const batchSize = 200;
  const batches: number[][] = [];
  for (let i = 0; i < bugIds.length; i += batchSize) {
    batches.push(bugIds.slice(i, i + batchSize));
  }

  const bugDetails: {
    id: number;
    title: string;
    severity: string;
    agingInDays: number;
  }[] = [];

  for (const batch of batches) {
    const res = await azureClient.post(`/_apis/wit/workitemsbatch?api-version=${apiVersion}`, {
      ids: batch,
      fields: [
        'System.Title',
        'System.CreatedDate',
        'Microsoft.VSTS.Common.ClosedDate',
        'Microsoft.VSTS.Common.Severity'
      ]
    });

    for (const item of res.data.value) {
      const created = new Date(item.fields['System.CreatedDate']);
      const closed = item.fields['Microsoft.VSTS.Common.ClosedDate']
        ? new Date(item.fields['Microsoft.VSTS.Common.ClosedDate'])
        : null;

      const agingInDays = closed
        ? Math.ceil((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      bugDetails.push({
        id: item.id,
        title: item.fields['System.Title'],
        severity: item.fields['Microsoft.VSTS.Common.Severity'] || 'Unknown',
        agingInDays: agingInDays ?? -1 // If is not Closed
      });
    }
  }

  return bugDetails;
}

export async function getBugLeakageBreakdown(areaPaths: string[]) {
  const apiVersion = process.env.AZURE_API_VERSION;
  const project = process.env.ADO_PROJECT;
  const ADO_BUG_ENVIRONMT_CUSTOM_FIELD = process.env.ADO_BUG_ENVIRONMT_CUSTOM_FIELD
  const ADO_PROD_ENVIRONMENT_LABEL = process.env.ADO_PROD_ENVIRONMENT_LABEL
  const ranges = [30, 60, 90, 180];

  const results = {
    teams: [] as any[],
    overall: [] as any[]
  };

  for (const days of ranges) {
    const since = dayjs().subtract(days, 'day');
    const until = dayjs();

    let overallProd = 0;
    let overallPreProd = 0;
    const overallEnvs: Record<string, any> = {};

    for (const areaPath of areaPaths) {
      const wiqlQuery = {
        query: `
          SELECT [System.Id]
          FROM WorkItems
          WHERE 
            [System.TeamProject] = '${decodeURIComponent(project!)}'
            AND [System.WorkItemType] = 'Bug'
            AND [System.AreaPath] UNDER '${areaPath}'
            AND [Microsoft.VSTS.Common.ClosedDate] >= '${since.format('YYYY-MM-DD')}'
            AND [Microsoft.VSTS.Common.ClosedDate] <= '${until.format('YYYY-MM-DD')}'
        `
      };

      const res = await azureClient.post(`/${project}/_apis/wit/wiql?api-version=${apiVersion}`, wiqlQuery);
      const ids = res.data.workItems.map((w: any) => w.id);

      const envMap: Record<string, any> = {};
      let prodCount = 0;
      let preProdCount = 0;

      if (ids.length) {
        const batchSize = 200;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);

          const detailRes = await azureClient.post(`/_apis/wit/workitemsbatch?api-version=7.1`, {
            ids: batch,
            fields: [
              'System.Id',
              'Microsoft.VSTS.Common.Severity',
              ADO_BUG_ENVIRONMT_CUSTOM_FIELD
            ]
          });

          for (const item of detailRes.data.value) {
            const envRaw = item.fields[ADO_BUG_ENVIRONMT_CUSTOM_FIELD!] || 'UNKNOWN';
            const env = envRaw.trim().toUpperCase();
            const severity = item.fields['Microsoft.VSTS.Common.Severity'] || 'UNKNOWN';

            if (env.includes(ADO_PROD_ENVIRONMENT_LABEL)) {
              prodCount++;
              overallProd++;
            } else {
              preProdCount++;
              overallPreProd++;
            }

            if (!envMap[env]) {
              envMap[env] = {
                total: 0,
                severities: {}
              };
            }

            envMap[env].total++;
            envMap[env].severities[severity] = (envMap[env].severities[severity] || 0) + 1;

            if (!overallEnvs[env]) {
              overallEnvs[env] = {
                total: 0,
                severities: {}
              };
            }

            overallEnvs[env].total++;
            overallEnvs[env].severities[severity] = (overallEnvs[env].severities[severity] || 0) + 1;
          }
        }
      }

      const orderedEnvMap = Object.keys(envMap).sort().map(env => {
        const severitiesList = Object.entries(envMap[env].severities)
          .filter(([s, count]) => !(s === 'UNKNOWN' && count === 0))
          .map(([severity, count]) => ({
            severity,
            total: count
          }))
          .sort((a, b) => a.severity.localeCompare(b.severity));

        return {
          environment: env,
          total: envMap[env].total,
          severities: severitiesList
        };
      });

      const bugLeakage = prodCount + preProdCount === 0
        ? 0
        : (prodCount / (prodCount + preProdCount)) * 100;

      results.teams.push({
        areaPath,
        timeRange: `${days}d`,
        bugLeakagePct: `${bugLeakage.toFixed(2)}%`,
        environments: orderedEnvMap
      });
    }

    const orderedOverallEnvs = Object.keys(overallEnvs).sort().map(env => {
      const severitiesList = Object.entries(overallEnvs[env].severities)
        .filter(([s, count]) => !(s === 'UNKNOWN' && count === 0))
        .map(([severity, count]) => ({
          severity,
          total: count
        }))
        .sort((a, b) => a.severity.localeCompare(b.severity));

      return {
        environment: env,
        total: overallEnvs[env].total,
        severities: severitiesList
      };
    });

    const overallLeakage = overallProd + overallPreProd === 0
      ? 0
      : (overallProd / (overallProd + overallPreProd)) * 100;

    results.overall.push({
      timeRange: `${days}d`,
      bugLeakagePct: `${overallLeakage.toFixed(2)}%`,
      environments: orderedOverallEnvs
    });
  }

  return results;
}


  
  
  
  
  
  
  
