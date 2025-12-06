// components/FileTree.tsx – TreeNode-Struktur + Helper

import type { ProjectFile } from '../contexts/types';

export type TreeNodeType = 'file' | 'folder';

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: TreeNodeType;
  parentPath: string | null;
  children?: TreeNode[];
  file?: ProjectFile;
}

/**
 * Sortiert Knoten so, dass:
 * - Ordner oben
 * - innerhalb von Ordnern/Dateien alphabetisch nach Name
 */
export function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
  });

  return sorted.map((node) => ({
    ...node,
    children: node.children ? sortTreeNodes(node.children) : undefined,
  }));
}

/**
 * Baut den kompletten Baum aus der flachen ProjectFile-Liste.
 */
export function buildFileTree(files: ProjectFile[]): TreeNode[] {
  const folderMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  const ensureFolder = (folderPath: string): TreeNode => {
    if (folderMap.has(folderPath)) {
      return folderMap.get(folderPath)!;
    }

    const parts = folderPath.split('/').filter(Boolean);
    const name = parts[parts.length - 1] ?? '';
    const parentPath =
      parts.length > 1 ? parts.slice(0, parts.length - 1).join('/') : '';

    const node: TreeNode = {
      id: `folder:${folderPath || '/'}`,
      name: name || '/',
      path: folderPath,
      type: 'folder',
      parentPath: parentPath || null,
      children: [],
    };

    folderMap.set(folderPath, node);

    if (parentPath) {
      const parent = ensureFolder(parentPath);
      parent.children = parent.children || [];
      if (!parent.children.find((c) => c.path === node.path)) {
        parent.children.push(node);
      }
    } else {
      if (!rootNodes.find((n) => n.path === node.path)) {
        rootNodes.push(node);
      }
    }

    return node;
  };

  for (const file of files) {
    const normalizedPath = file.path.replace(/^\/+/, '').replace(/\/+/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);

    const fileName = parts[parts.length - 1];
    const folderPath =
      parts.length > 1 ? parts.slice(0, parts.length - 1).join('/') : '';

    if (folderPath) {
      ensureFolder(folderPath);
    }

    const parentNode =
      folderPath === ''
        ? null
        : folderMap.get(folderPath) ?? ensureFolder(folderPath);

    const node: TreeNode = {
      id: `file:${normalizedPath}`,
      name: fileName,
      path: normalizedPath,
      type: 'file',
      parentPath: folderPath || null,
      file,
    };

    if (parentNode) {
      parentNode.children = parentNode.children || [];
      parentNode.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  // Ordner/Dateien rekursiv sortieren
  return sortTreeNodes(rootNodes);
}

/**
 * Inhalt eines Ordners (direkte Kinder) zurückgeben.
 */
export function findFolderContent(
  tree: TreeNode[],
  folderPath: string,
): TreeNode[] {
  const normalized = folderPath.replace(/^\/+/, '').replace(/\/+/g, '/');

  if (!normalized) {
    return tree;
  }

  // Rekursiv Ordner suchen
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'folder') {
      if (node.path === normalized) {
        return node.children ? sortTreeNodes(node.children) : [];
      }
      if (node.children) {
        stack.push(...node.children);
      }
    }
  }

  return [];
}
