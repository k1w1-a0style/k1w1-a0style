import React, { memo } from 'react';
import { Text, StyleSheet } from 'react-native';

type TokenType =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'function'
  | 'number'
  | 'operator'
  | 'default';

interface Token {
  type: TokenType;
  value: string;
}

type MatchInfo = {
  index: number;
  length: number;
  type: TokenType;
  value: string;
};

const KEYWORDS =
  /\b(import|export|const|let|var|function|return|if|else|for|while|class|extends|async|await|try|catch|throw|new|this|super|static|from|as|default|interface|type|enum)\b/g;
const STRINGS = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
const COMMENTS = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
const FUNCTIONS = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;
const NUMBERS = /\b(\d+\.?\d*)\b/g;

const tokenize = (code: string): Token[] => {
  const tokens: Token[] = [];
  const matches: MatchInfo[] = [];

  let match: RegExpExecArray | null;

  const commentRegex = new RegExp(COMMENTS);
  while ((match = commentRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'comment',
      value: match[0],
    });
  }

  const stringRegex = new RegExp(STRINGS);
  while ((match = stringRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'string',
      value: match[0],
    });
  }

  const keywordRegex = new RegExp(KEYWORDS);
  while ((match = keywordRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'keyword',
      value: match[0],
    });
  }

  const functionRegex = new RegExp(FUNCTIONS);
  while ((match = functionRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[1].length,
      type: 'function',
      value: match[1],
    });
  }

  const numberRegex = new RegExp(NUMBERS);
  while ((match = numberRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'number',
      value: match[0],
    });
  }

  matches.sort((a, b) => a.index - b.index);

  const filteredMatches: MatchInfo[] = [];
  let lastEnd = 0;

  matches.forEach((m) => {
    if (m.index >= lastEnd) {
      filteredMatches.push(m);
      lastEnd = m.index + m.length;
    }
  });

  let lastIndex = 0;

  filteredMatches.forEach((m) => {
    if (m.index > lastIndex) {
      tokens.push({
        type: 'default',
        value: code.substring(lastIndex, m.index),
      });
    }

    tokens.push({
      type: m.type,
      value: m.value,
    });

    lastIndex = m.index + m.length;
  });

  if (lastIndex < code.length) {
    tokens.push({
      type: 'default',
      value: code.substring(lastIndex),
    });
  }

  return tokens;
};

type SyntaxHighlighterProps = {
  code: string;
};

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = memo(
  ({ code }) => {
    const tokens = tokenize(code);

    return (
      <Text style={styles.codeBlock}>
        {tokens.map((token, index) => (
          <Text key={index} style={styles[token.type]}>
            {token.value}
          </Text>
        ))}
      </Text>
    );
  },
);

SyntaxHighlighter.displayName = 'SyntaxHighlighter';

const styles = StyleSheet.create({
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },
  keyword: {
    color: '#C586C0',
    fontWeight: '600',
  },
  string: {
    color: '#CE9178',
  },
  comment: {
    color: '#6A9955',
    fontStyle: 'italic',
  },
  function: {
    color: '#DCDCAA',
  },
  number: {
    color: '#B5CEA8',
  },
  operator: {
    color: '#D4D4D4',
  },
  default: {
    color: '#D4D4D4',
  },
});
