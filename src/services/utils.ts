import { AutomationStatus } from "../enums/automaton-status";

export function isAutomatedStatus(raw: string | undefined | null): boolean {
  if (!raw) return false;
  return !/^Not\b/i.test(raw.trim()) && /\bAutomated\b/i.test(raw);
}

export function getEffectiveStatus(fields: Record<string, any>): AutomationStatus {
  const standard = fields[process.env.ADO_AUTOMATION_STATUS_FIELD!];
  const custom = fields[process.env.ADO_CUSTOM_AUTOMATION_STATUS_FIELD!];

  if (isAutomatedStatus(standard) || isAutomatedStatus(custom)) return AutomationStatus.Automated;
  else return AutomationStatus.Manual
}

export function getEmptyPlanResponse() {
  return {
    plan: { id: null, name: 'No Plan' },
    metrics: {
      plans: [{ planName: 'No Plan' }],
      overall: {
        total: 0,
        totalToBeExecuted: 0,
        totalNotExecuted: 0,
        passRate: 0,
        executionCoverage: 0,
        manual: 0,
        automated: 0,
      },
    },
  };
}