
export type TeamBugMetrics = {
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

export type SprintBugReport = {
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