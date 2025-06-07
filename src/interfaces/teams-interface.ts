
export interface Team {
  id: string;
  name: string;
}

export interface IterationAttributes {
  startDate: string;
  finishDate: string;
  timeFrame: 'past' | 'current' | 'future';
}

export interface Iteration {
  id: string;
  name: string;
  path: string;
  attributes: IterationAttributes;
}