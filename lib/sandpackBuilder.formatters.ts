export function joinCspDirectives(directives: readonly string[]): string {
  return directives.join("; ");
}

export function collectCssFiles(files: Record<string, string>): string {
  return Object.entries(files)
    .filter(([path]) => path.endsWith(".css"))
    .map(([, content]) => content)
    .join("\n");
}
