export interface SonarComponent {
  key: string;
  qualifier: string;
  name: string;
  project: string;
}

export interface SonarComponentsResponse {
  paging: {
    pageIndex: number;
    pageSize: number;
    total: number;
  };
  components: SonarComponent[];
}