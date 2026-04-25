export type MessagePart =
  | { type: "text"; content: string }
  | { type: "code"; language: string; content: string };

export const parseMessageContent = (content: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  const s = String(content ?? "").replace(/\r\n/g, "\n");

  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(s)) !== null) {
    const before = s.slice(lastIndex, match.index);
    if (before.trim().length > 0) parts.push({ type: "text", content: before });

    const language = match[1] || "text";
    const codeContent = String(match[2] ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\s+$/, "");
    if (codeContent.trim().length > 0)
      parts.push({ type: "code", language, content: codeContent });

    lastIndex = match.index + match[0].length;
  }

  const rest = s.slice(lastIndex);
  if (rest.trim().length > 0) parts.push({ type: "text", content: rest });

  if (parts.length === 0) parts.push({ type: "text", content: s });
  return parts;
};
