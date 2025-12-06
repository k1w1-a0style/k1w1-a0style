// hooks/useFileTree.ts – Hook für FileTree + aktuellen Ordner

import { useMemo, useState } from 'react';
import type { ProjectFile } from '../contexts/types';
import {
  buildFileTree,
  findFolderContent,
  type TreeNode,
} from '../components/FileTree';

export interface UseFileTreeResult {
  fileTree: TreeNode[];
  currentFolderPath: string;
  currentFolderItems: TreeNode[];
  setCurrentFolderPath: (path: string) => void;
}

export function useFileTree(files: ProjectFile[]): UseFileTreeResult {
  const [currentFolderPath, setCurrentFolderPath] = useState<string>('');

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const currentFolderItems = useMemo(
    () => findFolderContent(fileTree, currentFolderPath),
    [fileTree, currentFolderPath],
  );

  return {
    fileTree,
    currentFolderPath,
    currentFolderItems,
    setCurrentFolderPath,
  };
}
