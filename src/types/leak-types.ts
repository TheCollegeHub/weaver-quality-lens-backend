export interface LeakEnvDetail {
    environment: string;
    total: number;
    severities: Array<{ severity: string; total: number, rate?: string}>;
  }
  
  export interface TeamLeakageEntry {
    areaPath: string;
    sprint: string;
    totalBugs: number;
    bugLeakagePct: string;
    environments: LeakEnvDetail[];
  }
  
  export interface SprintOverallEntry {
    sprint: string;
    totalBugs: number;
    prod: number;
    preProd: number;
    bugLeakagePct: string;
    environments: LeakEnvDetail[];
  }

  export interface OverallSeverity {
      total: number,
      severities: Array<{ severity: string; total: number, rate?: string}>;
      distributionByEnv: Array<{
        severity: string;
        totalProd: number,
        totalNonProd: number
        prodPct: string;
        nonProdPct: string;
      }>;
  };
  
  export interface BugLeakageBySprintResult {
    teams: TeamLeakageEntry[];
    sprintOverall: SprintOverallEntry[];
    overall: LeakEnvDetail[];
    overallSeverity: OverallSeverity
  }