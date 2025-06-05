export type SprintData = {
  name: string;
  iterationPath: string;
  startDate: string;
  finishDate: string;
  timeFrame?: string;
  teamName?: string
}

export type OpenAndCLosedBugMetric = {
  opened: {
    total: number;
    bugLinks: string[];
  };
  closed: {
    total: number;
    bugLinks: string[];
  };
  stillOpen: string;
}

export type BugAging = {
    averageDays: string | null;
    agingAboveThresholdLinks: string[];
    bugAgingBySeverity: {
      severity: string;
      count: number;
      averageDays: string;
    }[]
}

export type SprintBugReport = {
  teams: {
    areaPath: string
    sprints: {
      sprint: SprintData
      openAndClosedBugMetric?: OpenAndCLosedBugMetric,
      bugAging?: BugAging;
    }[]
  }[],
  sprintOveralls: {
    sprint: SprintData
    openAndClosedBugMetric?: OpenAndCLosedBugMetric,
    bugAging: BugAging;
  }[],
  overall: {
    openAndClosedBugMetric?: OpenAndCLosedBugMetric,
    bugAging: BugAging;
  };
};