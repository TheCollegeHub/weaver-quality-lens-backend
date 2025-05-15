import { azureClient } from '../utils/azure-client.js';
import { SprintData } from '../types/bug-metric-types.js';
import _ from "lodash";


const getPastSprintsByClassificationNodes = async (project: string, areaPaths: string[], numSprints: number): Promise<SprintData[]> => {
  const apiVersion = process.env.AZURE_API_VERSION;
  const iterationsUrl = `/${project}/_apis/wit/classificationnodes/iterations?$depth=3&api-version=${apiVersion}`;
  const { data } = await azureClient.get(iterationsUrl);

  const now = new Date();

  const teamNames = areaPaths!.map(areaPath => {
    const parts = areaPath.split('\\');
    return parts[1]?.toLowerCase();
  }).filter(Boolean);

  const teamNodes = data.children.filter((node: any) =>
    teamNames.includes(node.name.toLowerCase())
  );

  const allSprints = teamNodes.flatMap((teamNode: any) => {
    const teamIterationPath = teamNode.path.replace(/\\Iteration/, '');

    return (teamNode.children || [])
      .filter((sprint: any) => sprint.attributes?.startDate && sprint.attributes?.finishDate)
      .filter((sprint: any) => new Date(sprint.attributes.finishDate) < now)
      .map((sprint: any) => ({
        name: sprint.name,
        iterationPath: `${teamIterationPath}\\${sprint.name}`.replace(/^\\/, ''),
        startDate: sprint.attributes.startDate,
        finishDate: sprint.attributes.finishDate,
        timeFrame: sprint.attributes.timeFrame,
      }));
  });

  const uniqueSprints = allSprints.filter((sprint: { iterationPath: any; }, index: any, self: any[]) => 
    index === self.findIndex((t) => t.iterationPath === sprint.iterationPath)
  );

  const sortedSprints = uniqueSprints
    .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, numSprints);

  return sortedSprints;
};







  
  
  
  
  
  
  
