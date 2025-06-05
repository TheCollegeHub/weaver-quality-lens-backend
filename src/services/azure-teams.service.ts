import { SprintBugReport, SprintData } from '../types/bug-metric-types.js';
import { BugLeakageBySprintResult, LeakEnvDetail } from '../types/leak-types.js';
import { SprintMetrics } from '../interfaces/sprint-automation-metrics-interface.js';
import { getTestPlanData } from './azure-testplans.service.js';
import { fetchWiql, fetchWorkItemsBatch } from '../repositories/azure-workitems.repository.js';
import dayjs from 'dayjs';
import _ from "lodash";
import { fetchTeamIterations } from '../repositories/azure-organization.repository.js';


const ADO_PROJECT = process.env.ADO_PROJECT
const ADO_ORGANIZATION = process.env.ADO_ORGANIZATION
const CHUNK_SIZE = 200;

export async function getPastSprintsByTeamSettings(numSprints: number): Promise<SprintData[]> {
  const iterations = await fetchTeamIterations();

  const pastSprints: SprintData[] = iterations.value
    .filter((s: any) =>
      s.attributes?.startDate &&
      s.attributes?.finishDate &&
      s.attributes?.timeFrame === 'past'
    )
    .sort((a: any, b: any) =>
      new Date(b.attributes.startDate).getTime() - new Date(a.attributes.startDate).getTime()
    )
    .slice(0, numSprints)
    .map((s: any) => ({
      name: s.name,
      iterationPath: s.path,
      startDate: s.attributes.startDate,
      finishDate: s.attributes.finishDate,
      timeFrame: s.attributes.timeFrame
    }));

  return pastSprints;
}

export async function getBugMetricsBySprints(areaPaths: string[], numSprints: number): Promise<SprintBugReport> {
  const pastSprints = await getPastSprintsByTeamSettings(numSprints);
  const teamsBugs: SprintBugReport['teams'] = [];
  const sprintOveralls: SprintBugReport['sprintOveralls'] = [];

  let totalOpened = 0;
  let totalClosed = 0;
  let totalOpenedLinks: string[] = [];
  let totalClosedLinks: string[] = [];
  let totalAgingDays = 0;
  let totalClosedForAging = 0;
  let overallAgingAboveThresholdLinks: string[] = [];
  const overallAgingBySeverity: Record<string, { count: number; totalDays: number }> = {};

  for (const sprint of pastSprints) {
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.finishDate);
    end.setHours(23, 59, 59, 999);

    if (!areaPaths?.length) break;

    let sprintOpened = 0;
    let sprintClosed = 0;
    let sprintOpenedLinks: string[] = [];
    let sprintClosedLinks: string[] = [];
    let sprintTotalAgingDays = 0;
    let sprintClosedForAging = 0;
    let sprintAgingAboveThresholdLinks: string[] = [];
    const sprintAgingBySeverity: Record<string, { count: number; totalDays: number }> = {};

    for (const areaPath of areaPaths) {
      const wiqlQuery = {
        query: `
          SELECT [System.Id]
          FROM WorkItems
          WHERE 
            [System.TeamProject] = '${decodeURIComponent(ADO_PROJECT!)}'
            AND [System.WorkItemType] = 'Bug'
            AND [System.AreaPath] UNDER '${areaPath}'
            AND [System.IterationPath] UNDER '${sprint.iterationPath}'
        `
      };

      const res = await fetchWiql(wiqlQuery);
      const ids = res.data.workItems.map((w: any) => w.id);

      const openedIds: number[] = [];
      const closedIds: number[] = [];
      let sprintAreaAgingTotal = 0;
      let sprintAreaClosedCount = 0;
      const agingAboveThresholdLinks: string[] = [];
      const areaAgingBySeverity: Record<string, { count: number; totalDays: number }> = {};

      if (ids.length) {
        const batches = [];
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          batches.push(ids.slice(i, i + CHUNK_SIZE));
        }

        for (const batch of batches) {
          const detailRes = await fetchWorkItemsBatch({
            ids: batch,
            fields: [
              'System.State',
              'System.CreatedDate',
              'Microsoft.VSTS.Common.ClosedDate',
              'Microsoft.VSTS.Common.Severity'
            ]
          })
          for (const item of detailRes.data.value) {
            const created = new Date(item.fields['System.CreatedDate']);
            const closed = item.fields['Microsoft.VSTS.Common.ClosedDate']
              ? new Date(item.fields['Microsoft.VSTS.Common.ClosedDate'])
              : null;

            const severity = item.fields['Microsoft.VSTS.Common.Severity'] || 'Unknown';

            const createdInSprint = created >= start && created <= end;
            
            // const closedInSprint = closed && closed >= start && closed <= end;
            // How to handle when bug belongs to Sprint was closed but after Sprint was finished? 
            // It happens when the team forgets to update work item status before sprint is fininished.
            const closedInSprint = closed && closed >= start;
            
            if (createdInSprint) openedIds.push(item.id);
            if (closedInSprint) {
              closedIds.push(item.id);

              const agingDays = Math.ceil((closed!.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
              sprintAreaAgingTotal += agingDays;
              sprintAreaClosedCount++;
              sprintTotalAgingDays += agingDays;
              sprintClosedForAging++;
              totalAgingDays += agingDays;
              totalClosedForAging++;

              if (!areaAgingBySeverity[severity]) {
                areaAgingBySeverity[severity] = { count: 0, totalDays: 0 };
              }
              areaAgingBySeverity[severity].count++;
              areaAgingBySeverity[severity].totalDays += agingDays;

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
                const link = `https://dev.azure.com/${ADO_ORGANIZATION}/${ADO_PROJECT}/_workitems/edit/${item.id}`;
                agingAboveThresholdLinks.push(link);
                sprintAgingAboveThresholdLinks.push(link);
                overallAgingAboveThresholdLinks.push(link);
              }
            }
          }
        }
      }

      const bugLink = (id: number) =>
        `https://dev.azure.com/${ADO_ORGANIZATION}/${ADO_PROJECT}/_workitems/edit/${id}`;

      const openedLinks = openedIds.map(bugLink);
      const closedLinks = closedIds.map(bugLink);

      totalOpened += openedIds.length;
      totalClosed += closedIds.length;
      totalOpenedLinks.push(...openedLinks);
      totalClosedLinks.push(...closedLinks);

      sprintOpened += openedIds.length;
      sprintClosed += closedIds.length;
      sprintOpenedLinks.push(...openedLinks);
      sprintClosedLinks.push(...closedLinks);

      const stillOpenRaw = openedIds.length === 0
        ? 0
        : ((openedIds.length - closedIds.length) / openedIds.length) * 100;

      const stillOpenPct = `${Math.max(0, stillOpenRaw).toFixed(2)}%`;

      const bugAgingBySeverityArray = Object.entries(areaAgingBySeverity)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([severity, data]) => ({
          severity,
          count: data.count,
          averageDays: (data.totalDays / data.count).toFixed(2)
        }));

      let team = teamsBugs.find(team => team.areaPath === areaPath);
      if (!team) {
        team = {
          areaPath,
          sprints: []
        };
        teamsBugs.push(team);
      }

      const sprintMetric = {
        sprint: {
          name: sprint.name,
          iterationPath: sprint.iterationPath,
          startDate: sprint.startDate,
          finishDate: sprint.finishDate
        },
        openAndClosedBugMetric: {
          opened: {
            total: openedIds.length,
            bugLinks: openedLinks
          },
          closed: {
            total: closedIds.length,
            bugLinks: closedLinks
          },
          stillOpen: stillOpenPct
        },
        bugAging: {
          averageDays: sprintAreaClosedCount === 0 ? null : (sprintAreaAgingTotal / sprintAreaClosedCount).toFixed(2),
          agingAboveThresholdLinks,
          bugAgingBySeverity: bugAgingBySeverityArray
        }
      }
      team.sprints.push(sprintMetric);
      
    }

    const sprintStillOpenRaw = sprintOpened === 0
      ? 0
      : ((sprintOpened - sprintClosed) / sprintOpened) * 100;

    const sprintStillOpenPct = `${Math.max(0, sprintStillOpenRaw).toFixed(2)}%`;

    const sprintAgingBySeverityArray = Object.entries(sprintAgingBySeverity)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([severity, data]) => ({
        severity,
        count: data.count,
        averageDays: (data.totalDays / data.count).toFixed(2)
      }));

    sprintOveralls.push({
      sprint: {
        name: sprint.name,
        iterationPath: sprint.iterationPath,
        startDate: sprint.startDate,
        finishDate: sprint.finishDate
      },
      openAndClosedBugMetric: {
        opened: {
          total: sprintOpened,
          bugLinks: sprintOpenedLinks
        },
        closed: {
          total: sprintClosed,
          bugLinks: sprintClosedLinks
        },
        stillOpen: sprintStillOpenPct
      },
      bugAging: {
        averageDays: sprintClosedForAging === 0 ? null : (sprintTotalAgingDays / sprintClosedForAging).toFixed(2),
        agingAboveThresholdLinks: sprintAgingAboveThresholdLinks,
        bugAgingBySeverity: sprintAgingBySeverityArray
      }
    });
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
    teams: teamsBugs,
    sprintOveralls,
    overall: {
      openAndClosedBugMetric: {
        opened: {
          total: totalOpened,
          bugLinks: totalOpenedLinks
        },
        closed: {
          total: totalClosed,
          bugLinks: totalClosedLinks
        },
        stillOpen: overallStillOpenPct
      },
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

  // 1) build a map from bugId → original link
  const linkMap = new Map<number,string>();
  const bugIds: number[] = links
    .map(link => {
      const match = link.match(/\/edit\/(\d+)/);
      if (match) {
        const id = Number(match[1]);
        linkMap.set(id, link);
        return id;
      }
      return null;
    })
    .filter((id): id is number => id !== null);

  // 2) split into batches of 200
  const batches: number[][] = [];
  for (let i = 0; i < bugIds.length; i += CHUNK_SIZE) {
    batches.push(bugIds.slice(i, i + CHUNK_SIZE));
  }

  // 3) fetch each batch and assemble details
  const bugDetails: Array<{
    id: number;
    link: string;
    title: string;
    severity: string;
    agingInDays: number;
  }> = [];

  for (const batch of batches) {
    const res = await fetchWorkItemsBatch({
      ids: batch,
      fields: [
        'System.Title',
        'System.CreatedDate',
        'Microsoft.VSTS.Common.ClosedDate',
        'Microsoft.VSTS.Common.Severity'
      ]
    })

    for (const item of res.data.value) {
      const created = new Date(item.fields['System.CreatedDate']);
      const closed = item.fields['Microsoft.VSTS.Common.ClosedDate']
        ? new Date(item.fields['Microsoft.VSTS.Common.ClosedDate'])
        : null;

      const agingInDays = closed
        ? Math.ceil((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        : -1; // or `undefined`, if you prefer

      bugDetails.push({
        id: item.id,
        link: linkMap.get(item.id)!,
        title: item.fields['System.Title'],
        severity: item.fields['Microsoft.VSTS.Common.Severity'] || 'Unknown',
        agingInDays
      });
    }
  }

  return bugDetails;
}

export async function getBugLeakageBreakdown(areaPaths: string[]) {
  const apiVersion = process.env.AZURE_API_VERSION;
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
            [System.TeamProject] = '${decodeURIComponent(ADO_PROJECT!)}'
            AND [System.WorkItemType] = 'Bug'
            AND [System.AreaPath] UNDER '${areaPath}'
            AND [Microsoft.VSTS.Common.ClosedDate] >= '${since.format('YYYY-MM-DD')}'
            AND [Microsoft.VSTS.Common.ClosedDate] <= '${until.format('YYYY-MM-DD')}'
        `
      };
      const res = await fetchWiql(wiqlQuery);

      const ids = res.data.workItems.map((w: any) => w.id);

      const envMap: Record<string, any> = {};
      let prodCount = 0;
      let preProdCount = 0;

      if (ids.length) {
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const batch = ids.slice(i, i + CHUNK_SIZE);

          const detailRes = await fetchWorkItemsBatch({
            ids: batch,
            fields: [
              'System.Id',
              'Microsoft.VSTS.Common.Severity',
              ADO_BUG_ENVIRONMT_CUSTOM_FIELD!
            ]
          })

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

export async function getBugLeakageBySprint(areaPaths: string[], numSprints: number): Promise<BugLeakageBySprintResult> {
  const apiVersion = process.env.AZURE_API_VERSION!;
  const project = decodeURIComponent(process.env.ADO_PROJECT!);
  const ADO_BUG_ENVIRONMT_CUSTOM_FIELD = process.env.ADO_BUG_ENVIRONMT_CUSTOM_FIELD!;
  const ADO_PROD_ENVIRONMENT_LABEL = process.env.ADO_PROD_ENVIRONMENT_LABEL!;

  const sprintCounts: Record<string, { prod: number; preProd: number }> = {};
  const sprintEnvAgg: Record<string, Record<string, { total: number; severities: Record<string, number> }>> = {};
  const overallEnvAgg: Record<string, { total: number; severities: Record<string, number> }> = {};

  const results: BugLeakageBySprintResult = {
    teams: [],
    sprintOverall: [],
    overall: [],
    overallSeverity: {
      total: 0,
      severities: [],
       distributionByEnv: []
    }
  };

  for (const areaPath of areaPaths) {
    const itersRes = await fetchTeamIterations();

    const recentIters = itersRes.value
      .filter((i: any) => i.attributes?.finishDate && dayjs(i.attributes.finishDate).isBefore(dayjs()))
      .sort((a: any, b: any) => dayjs(b.attributes.finishDate).diff(dayjs(a.attributes.finishDate)))
      .slice(0, numSprints);

    for (const iter of recentIters) {
      const sprintName = iter.name;
      const iterationPath = iter.path;

      const wiql = {
        query: `
          SELECT [System.Id]
            FROM WorkItems
           WHERE [System.TeamProject] = '${project}'
             AND [System.WorkItemType] = 'Bug'
             AND [System.AreaPath] UNDER '${areaPath}'
             AND [System.IterationPath] = '${iterationPath}'
        `
      };

      const wiqlRes =  await fetchWiql(wiql);
      const ids: number[] = wiqlRes.data.workItems.map((w: any) => w.id);

      const envMap: Record<string, { total: number; severities: Record<string, number> }> = {};
      let prodCount = 0;
      let preProdCount = 0;

      if (ids.length) {
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const batch = ids.slice(i, i + CHUNK_SIZE);
          
          const detailRes = await fetchWorkItemsBatch({
              ids: batch,
              fields: [
                'System.Id',
                ADO_BUG_ENVIRONMT_CUSTOM_FIELD,
                'Microsoft.VSTS.Common.Severity'
              ]
            })

          for (const bug of detailRes.data.value) {
            const envRaw = bug.fields[ADO_BUG_ENVIRONMT_CUSTOM_FIELD] || 'UNKNOWN';
            const env = envRaw.trim().toUpperCase();
            const sev = bug.fields['Microsoft.VSTS.Common.Severity'] || 'UNKNOWN';

            if (env.includes(ADO_PROD_ENVIRONMENT_LABEL)) {
              prodCount++;
            } else {
              preProdCount++;
            }

            if (!envMap[env]) {
              envMap[env] = { total: 0, severities: {} };
            }
            envMap[env].total++;
            envMap[env].severities[sev] = (envMap[env].severities[sev] || 0) + 1;
          }
        }
      }

      const total = prodCount + preProdCount;
      const pct = total === 0 ? '0.00%' : `${((prodCount / total) * 100).toFixed(2)}%`;
      const orderedEnvMap: LeakEnvDetail[] = Object.entries(envMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([env, { total, severities }]) => ({
          environment: env,
          total,
          severities: Object.entries(severities)
            .filter(([, c]) => c > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([severity, count]) => ({ severity, total: count }))
        }));

      results.teams.push({
        areaPath,
        sprint: sprintName,
        totalBugs: total,
        bugLeakagePct: pct,
        environments: orderedEnvMap
      });

      sprintCounts[sprintName] = sprintCounts[sprintName] || { prod: 0, preProd: 0 };
      sprintCounts[sprintName].prod += prodCount;
      sprintCounts[sprintName].preProd += preProdCount;

      sprintEnvAgg[sprintName] = sprintEnvAgg[sprintName] || {};
      for (const [env, { total, severities }] of Object.entries(envMap)) {
        const sprintAgg = sprintEnvAgg[sprintName][env] || { total: 0, severities: {} };
        sprintAgg.total += total;
        for (const [sev, count] of Object.entries(severities)) {
          sprintAgg.severities[sev] = (sprintAgg.severities[sev] || 0) + count;
        }
        sprintEnvAgg[sprintName][env] = sprintAgg;

        const overallAgg = overallEnvAgg[env] || { total: 0, severities: {} };
        overallAgg.total += total;
        for (const [sev, count] of Object.entries(severities)) {
          overallAgg.severities[sev] = (overallAgg.severities[sev] || 0) + count;
        }
        overallEnvAgg[env] = overallAgg;
      }
    }
  }

  results.sprintOverall = Object.entries(sprintCounts)
    .map(([sprint, { prod, preProd }]) => {
      const total = prod + preProd;
      const pct = total === 0 ? '0.00%' : `${((prod / total) * 100).toFixed(2)}%`;
      const environments: LeakEnvDetail[] = Object.entries(sprintEnvAgg[sprint] || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([env, { total, severities }]) => ({
          environment: env,
          total,
          severities: Object.entries(severities)
            .filter(([, c]) => c > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([severity, count]) => ({ severity, total: count }))
        }));

      return {
        sprint,
        totalBugs: total,
        prod,
        preProd,
        bugLeakagePct: pct,
        environments
      };
    })
    .sort((a, b) => a.sprint.localeCompare(b.sprint));

  results.overall = Object.entries(overallEnvAgg)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([env, { total, severities }]) => ({
      environment: env,
      total,
      severities: Object.entries(severities)
        .filter(([, c]) => c > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([severity, count]) => ({ severity, total: count }))
    }));

  for (const env of results.overall) {
    const total = env.total;
    for (const sev of env.severities) {
      const pct = total > 0 ? (sev.total / total) * 100 : 0;
      sev.rate = `${pct.toFixed(2)}%`;
    }
  }

  const severityCountMap: Record<string, number> = {};
  const severityEnvCountMap: Record<string, { prod: number; nonProd: number }> = {};
  let totalBugs = 0;

  for (const env of results.overall) {
    const isProd = env.environment.includes(ADO_PROD_ENVIRONMENT_LABEL);
    for (const sev of env.severities) {
      severityCountMap[sev.severity] = (severityCountMap[sev.severity] || 0) + sev.total;
      totalBugs += sev.total;

      if (!severityEnvCountMap[sev.severity]) {
        severityEnvCountMap[sev.severity] = { prod: 0, nonProd: 0 };
      }

      if (isProd) {
        severityEnvCountMap[sev.severity].prod += sev.total;
      } else {
        severityEnvCountMap[sev.severity].nonProd += sev.total;
      }
    }
  }

  const severities = Object.entries(severityCountMap).map(([severity, total]) => ({
    severity,
    total,
    rate: `${((total / totalBugs) * 100).toFixed(2)}%`
  }));

  const distributionByEnv = Object.entries(severityEnvCountMap).map(([severity, { prod, nonProd }]) => {
    const total = totalBugs
    const prodPct = total > 0 ? `${((prod / total) * 100).toFixed(2)}%` : '0.00%';
    const nonProdPct = total > 0 ? `${((nonProd / total) * 100).toFixed(2)}%` : '0.00%';
    return {
      severity,
      totalProd: prod,
      totalNonProd: nonProd,
      prodPct,
      nonProdPct
    };
  });

  results.overallSeverity = {
    total: totalBugs,
    severities,
    distributionByEnv
  };


  return results;
}

export const getSprintTestMetrics = async (areaPaths: string[], numSprints: number) => {
  const allSprintMetrics: Record<string, SprintMetrics[]> = {};
  const overallAccumulator: SprintMetrics[] = [];

  for (const areaPath of areaPaths) {
    const sprints = await getPastSprintsByTeamSettings(numSprints);
    const metricsPerSprint: SprintMetrics[] = [];

    for (const sprint of sprints) {
      const data = await getTestPlanData(areaPath, sprint.iterationPath);

      const metric: SprintMetrics = {
        sprintName: sprint.name,
        planName: data.metrics.plans[0].planName,
        totalTestCases: data.metrics.overall.total,
        totalTestCasesBeExecuted: data.metrics.overall.totalToBeExecuted,
        totalTestCasesExecuted: data.metrics.overall.totalToBeExecuted - data.metrics.overall.totalNotExecuted,
        totalTestCasesNotExecuted: data.metrics.overall.totalNotExecuted,
        passRate: data.metrics.overall.passRate,
        executionCoverage: data.metrics.overall.executionCoverage,
        manualTests: data.metrics.overall.manual,
        automatedTests: data.metrics.overall.automated,
      };

      metricsPerSprint.push(metric);
      overallAccumulator.push(metric);
    }

    allSprintMetrics[areaPath] = metricsPerSprint;
  }

  const sprintsMap: Map<string, SprintMetrics & {
    _executionCoverageSum: number;
    _coverageWeight: number;
    _passRateSum: number;
    _passRateWeight: number;
  }> = new Map();

  for (const metrics of Object.values(allSprintMetrics)) {
    for (const m of metrics) {
      if (!sprintsMap.has(m.sprintName)) {
        sprintsMap.set(m.sprintName, {
          ...m,
          _executionCoverageSum: m.executionCoverage * m.totalTestCasesBeExecuted,
          _coverageWeight: m.totalTestCasesBeExecuted,
          _passRateSum: m.passRate * m.totalTestCasesBeExecuted,
          _passRateWeight: m.totalTestCasesBeExecuted,
        });
      } else {
        const s = sprintsMap.get(m.sprintName)!;
        s.totalTestCases += m.totalTestCases;
        s.totalTestCasesBeExecuted += m.totalTestCasesBeExecuted;
        s.totalTestCasesExecuted += m.totalTestCasesBeExecuted - m.totalTestCasesNotExecuted;
        s.totalTestCasesNotExecuted += m.totalTestCasesNotExecuted;
        s.manualTests += m.manualTests;
        s.automatedTests += m.automatedTests;

        s._executionCoverageSum += m.executionCoverage * m.totalTestCasesBeExecuted;
        s._coverageWeight += m.totalTestCasesBeExecuted;

        s._passRateSum += m.passRate * m.totalTestCasesBeExecuted;
        s._passRateWeight += m.totalTestCasesBeExecuted;
      }
    }
  }

  const sprintsOverall: SprintMetrics[] = Array.from(sprintsMap.values()).map((s) => {
    const executionCoverage = s._coverageWeight
      ? s._executionCoverageSum / s._coverageWeight
      : 0;
    const passRate = s._passRateWeight
      ? s._passRateSum / s._passRateWeight
      : 0;

    const {
      _executionCoverageSum,
      _coverageWeight,
      _passRateSum,
      _passRateWeight,
      ...cleanSprint
    } = s;

    return {
      ...cleanSprint,
      executionCoverage: parseFloat(executionCoverage.toFixed(2)),
      passRate: parseFloat(passRate.toFixed(2)),
    };
  });

  const overall: SprintMetrics = overallAccumulator.reduce((acc, m) => {
    const toBeExecuted = m.totalTestCasesBeExecuted;

    acc.totalTestCases += m.totalTestCases;
    acc.totalTestCasesBeExecuted += toBeExecuted;
    acc.totalTestCasesExecuted += toBeExecuted - m.totalTestCasesNotExecuted;
    acc.totalTestCasesNotExecuted += m.totalTestCasesNotExecuted;
    acc.passRate += m.passRate * toBeExecuted;
    acc.executionCoverage += m.executionCoverage * toBeExecuted;
    acc.manualTests += m.manualTests;
    acc.automatedTests += m.automatedTests;

    (acc as any)._coverageWeight = ((acc as any)._coverageWeight || 0) + toBeExecuted;
    (acc as any)._passRateWeight = ((acc as any)._passRateWeight || 0) + toBeExecuted;

    return acc;
  }, {
    sprintName: 'Overall',
    planName: 'Overall',
    totalTestCases: 0,
    totalTestCasesBeExecuted: 0,
    totalTestCasesExecuted: 0,
    totalTestCasesNotExecuted: 0,
    passRate: 0,
    executionCoverage: 0,
    manualTests: 0,
    automatedTests: 0,
  } as SprintMetrics & { _coverageWeight?: number; _passRateWeight?: number });

  overall.passRate = parseFloat(
    ((overall.passRate) / ((overall as any)._passRateWeight || 1)).toFixed(2)
  );
  overall.executionCoverage = parseFloat(
    ((overall.executionCoverage) / ((overall as any)._coverageWeight || 1)).toFixed(2)
  );

  delete (overall as any)._passRateWeight;
  delete (overall as any)._coverageWeight;

  return {
    teams: areaPaths.map(area => ({
      areaPath: area,
      sprints: allSprintMetrics[area],
    })),
    sprintsOverall,
    overall
  };
};








  
  
  
  
  
  
  
