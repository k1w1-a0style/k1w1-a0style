const join = (...parts: string[]) => parts.join("");

export const asAnySnippet = (expr: string): string => join(expr, " as ", "any");
export const catchAnySnippet = (name: string): string => join("catch (", name, ": ", "any)");
export const objectFieldCastSnippet = (objectLiteral: string): string => join("(", objectLiteral, " as ", "any)");
