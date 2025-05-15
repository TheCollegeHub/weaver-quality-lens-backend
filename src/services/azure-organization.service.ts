import { fetchAreaNodes } from "../repositories/azure-organization.repository";

interface AreaNode {
  name: string;
  identifier?: string;
  children?: AreaNode[];
}

interface AreaPath {
  id: string;
  name: string;
}

export async function getAllAreaPaths(): Promise<AreaPath[]> {
  const paths: AreaPath[] = [];

  function traverse(node: AreaNode, parentPath = '') {
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
