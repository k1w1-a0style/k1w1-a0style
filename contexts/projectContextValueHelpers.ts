import type { ProjectContextProps } from "./projectTypes";

export const composeProjectContextValue = (
  params: ProjectContextProps,
): ProjectContextProps => ({
  ...params,
});
