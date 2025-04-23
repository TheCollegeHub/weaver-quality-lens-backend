import { AutomationMetricsResponse, PlanMetrics } from "../interfaces/testplans-interface";
import { azureClient } from '../utils/azureClient.js';
import { TestPlan } from '../interfaces/testplans-interface.js';
const ADO_AUTOMATION_STATUS_FIELD = process.env.ADO_AUTOMATION_STATUS_FIELD
const ADO_CUSTOM_AUTOMATION_STATUS_FIELD = process.env.ADO_CUSTOM_AUTOMATION_STATUS_FIELD
const ADO_TESTING_TYPE_FIELD = process.env.ADO_TESTING_TYPE_FIELD
const ADO_AUTOMATION_TOOLS_FIELD = process.env.ADO_AUTOMATION_TOOLS_FIELD
const ADO_PROJECT = process.env.ADO_PROJECT!;
const AZURE_API_VERSION = process.env.AZURE_API_VERSION!;

function isAutomatedStatus(raw: string | undefined | null): boolean {
  if (!raw) return false;
  return !/^Not\b/i.test(raw.trim()) && /\bAutomated\b/i.test(raw);
}

export async function getAutomationMetricsForPlans(testPlans: TestPlan[]): Promise<AutomationMetricsResponse> {
  const testCaseToPlans = new Map<number, Set<number>>();
  const planNamesMap = new Map<number, string>();

  await Promise.all(testPlans.map(async ({ id: planId, name: planName }) => {
    planNamesMap.set(planId, planName);
    const suitesRes = await azureClient.get(
      `/${ADO_PROJECT}/_apis/testplan/plans/${planId}/suites?api-version=${AZURE_API_VERSION}`
    );
    await Promise.all(suitesRes.data.value.map(async (suite: any) => {
      const casesRes = await azureClient.get(
        `/${ADO_PROJECT}/_apis/test/plans/${planId}/suites/${suite.id}/testcases?api-version=${AZURE_API_VERSION}`
      );
      for (const testCase of casesRes.data.value) {
        const id = Number(testCase.testCase.id);
        const set = testCaseToPlans.get(id) || new Set<number>();
        set.add(planId);
        testCaseToPlans.set(id, set);
      }
    }));
  }));

  const allTestCaseIds = Array.from(testCaseToPlans.keys());
  if (!allTestCaseIds.length) return { overall: emptyOverall(), plans: [] };

  const batchRes = await azureClient.post(
    `/_apis/wit/workitemsbatch?api-version=${AZURE_API_VERSION}`,
    {
      ids: allTestCaseIds,
      fields: [
        ADO_CUSTOM_AUTOMATION_STATUS_FIELD,
        ADO_AUTOMATION_STATUS_FIELD,
        ADO_TESTING_TYPE_FIELD,
        ADO_AUTOMATION_TOOLS_FIELD
      ]
    }
  );

  const metricsMap = new Map<number, PlanMetrics>();
  const overallLinks = { manual: [] as string[], automated: [] as string[] };
  const overallCategoryMap = new Map<string, { manual: number; automated: number }>();
  const overallToolMap = new Map<string, number>();
  let overallManual = 0, overallAutomated = 0;

  for (const item of batchRes.data.value) {
    const id = Number(item.id);

    const rawStatus = item.fields[ADO_CUSTOM_AUTOMATION_STATUS_FIELD!] ??
                      item.fields[ADO_AUTOMATION_STATUS_FIELD!] ??
                      '';
    const status: 'Automated' | 'Manual' = isAutomatedStatus(rawStatus) ? 'Automated' : 'Manual';

    const category = item.fields[ADO_TESTING_TYPE_FIELD!] || 'Uncategorized';
    const tool = item.fields[ADO_AUTOMATION_TOOLS_FIELD!] || 'UnknownTool';
    const link = `https://dev.azure.com/${process.env.ADO_ORGANIZATION}/${ADO_PROJECT}/_workitems/edit/${id}`;

    if (!overallCategoryMap.has(category)) {
      overallCategoryMap.set(category, { manual: 0, automated: 0 });
    }

    const cat = overallCategoryMap.get(category)!;
    if (status === 'Automated') {
      overallAutomated++;
      overallLinks.automated.push(link);
      cat.automated++;
    } else {
      overallManual++;
      overallLinks.manual.push(link);
      cat.manual++;
    }

    overallToolMap.set(tool, (overallToolMap.get(tool) || 0) + 1);

    for (const planId of testCaseToPlans.get(id)!) {
      if (!metricsMap.has(planId)) {
        metricsMap.set(planId, emptyPlan(planId, planNamesMap.get(planId)!));
      }

      const pm = metricsMap.get(planId)!;

      if (status === 'Automated') {
        pm.automated++;
        pm.links.automated.push(link);
      } else {
        pm.manual++;
        pm.links.manual.push(link);
      }

      pm.categories = upsertCategory(pm.categories, category, status);
      pm.tools = upsertTool(pm.tools, tool);
    }
  }

  const plans: PlanMetrics[] = [];
  await Promise.all(Array.from(metricsMap.values()).map(async pm => {
    pm.total = pm.manual + pm.automated;
    pm.automationCoverage = pm.total ? ((pm.automated / pm.total) * 100).toFixed(2) : '0.00';

    const results: string[] = [];
    const suitesRes = await azureClient.get(
      `/${ADO_PROJECT}/_apis/testplan/plans/${pm.planId}/suites?api-version=${AZURE_API_VERSION}`
    );
    await Promise.all(suitesRes.data.value.map(async (suite: any) => {
      const pointsRes = await azureClient.get(
        `/${ADO_PROJECT}/_apis/test/plans/${pm.planId}/suites/${suite.id}/points?api-version=${AZURE_API_VERSION}`
      );
      pointsRes.data.value.forEach((p: any) => results.push(p.outcome));
    }));

    const passedCount = results.filter(o => o === 'Passed').length;
    pm.passRate = results.length ? ((passedCount / results.length) * 100).toFixed(2) : '0.00';

    plans.push(pm);
  }));

  const overallTotal = overallManual + overallAutomated;
  const categories = Array.from(overallCategoryMap, ([name, v]) => ({ name, ...v }));
  const tools = Array.from(overallToolMap, ([name, total]) => ({ name, total }));

  return {
    overall: {
      manual: overallManual,
      automated: overallAutomated,
      total: overallTotal,
      automationCoverage: overallTotal ? ((overallAutomated / overallTotal) * 100).toFixed(2) : '0.00',
      passRate: plans.length ? (plans.reduce((sum, p) => sum + parseFloat(p.passRate), 0) / plans.length).toFixed(2) : '0.00',
      categories,
      tools,
      links: overallLinks
    },
    plans
  };
}


function emptyOverall(): AutomationMetricsResponse['overall'] {
  return { manual: 0, automated: 0, total: 0, automationCoverage: '0.00', passRate: '0.00', categories: [], tools: [], links: { manual: [], automated: [] } };
}

function emptyPlan(id: number, name: string): PlanMetrics {
  return { planId: id, planName: name, manual: 0, automated: 0, total: 0, automationCoverage: '0.00', passRate: '0.00', categories: [], tools: [], links: { manual: [], automated: [] } };
}

function upsertCategory(arr: any[], name: string, status: string) {
  let c = arr.find(x => x.name === name);
  if (!c) { c = { name, manual: 0, automated: 0 }; arr.push(c); }
  status === 'Automated' ? c.automated++ : c.manual++;
  return arr;
}

function upsertTool(arr: any[], name: string) {
  let t = arr.find(x => x.name === name);
  if (t) t.total++; else arr.push({ name, total: 1 });
  return arr;
}