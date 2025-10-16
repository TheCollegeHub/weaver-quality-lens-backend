import { fetchAreaNodes } from "../repositories/azure-organization.repository";
import { AreaNode, AreaPath } from "../types/azure-types";

export async function getAllAreaPaths(): Promise<AreaPath[]> {
  const paths: AreaPath[] = [];

  function traverse(node: AreaNode, parentPath = '') {
    // Use single backslashes for Azure DevOps compatibility
    const fullPath = parentPath ? `${parentPath}\\${node.name}` : node.name;
    
    paths.push({ id: node.identifier || fullPath, name: fullPath });

    if (node.children) {
      for (const child of node.children) {
        traverse(child, fullPath);
      }
    }
  }

  const rootNode: AreaNode = await fetchAreaNodes();
  traverse(rootNode);

  return paths;
}
