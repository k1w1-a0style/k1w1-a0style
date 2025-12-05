import { ProjectFile } from '../contexts/types';

export type TreeNode = {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  file?: ProjectFile;
  isExpanded?: boolean;
};

export const buildFileTree = (files: ProjectFile[]): TreeNode[] => {
  // ✅ PERFORMANCE FIX: Verwende Hash-Map statt Array.find() → O(n) statt O(n²)
  const folderMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  files.forEach(file => {
    const pathParts = file.path.split('/');
    let currentPath = '';

    pathParts.forEach((part, index) => {
      const isLast = index === pathParts.length - 1;
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        const fileNode: TreeNode = {
          id: file.path,
          name: part,
          path: file.path,
          type: 'file',
          file,
        };

        if (parentPath) {
          const parent = folderMap.get(parentPath);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(fileNode);
          }
        } else {
          rootNodes.push(fileNode);
        }
      } else {
        if (!folderMap.has(currentPath)) {
          const folderNode: TreeNode = {
            id: `folder_${currentPath}`,
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
            isExpanded: true,
          };

          folderMap.set(currentPath, folderNode);

          if (parentPath) {
            const parent = folderMap.get(parentPath);
            if (parent) {
              parent.children = parent.children || [];
              parent.children.push(folderNode);
            }
          } else {
            rootNodes.push(folderNode);
          }
        }
      }
    });
  });

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(rootNodes);
  return rootNodes;
};

export const findFolderContent = (nodes: TreeNode[], path: string): TreeNode[] => {
  if (!path) return nodes;

  for (const node of nodes) {
    if (node.path === path && node.type === 'folder') {
      return node.children || [];
    }
    if (node.children) {
      const result = findFolderContent(node.children, path);
      if (result.length > 0) return result;
    }
  }
  return [];
};
