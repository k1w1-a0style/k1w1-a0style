import React, { useMemo } from 'react';
import { Text, StyleSheet, Platform, View } from 'react-native';
import { theme } from '../theme';

interface Token {
  type: 'keyword' | 'string' | 'comment' | 'function' | 'number' | 'operator' | 'default' | 'type' | 'jsx';
  value: string;
}

// Erweiterte Regex für bessere Erkennung
const KEYWORDS = /\b(import|export|const|let|var|function|return|if|else|for|while|class|extends|async|await|try|catch|throw|new|this|super|static|from|as|default|interface|type|enum|implements|readonly|public|private|protected|abstract|declare|namespace|module)\b/g;
const TYPE_KEYWORDS = /\b(string|number|boolean|void|null|undefined|any|never|unknown|object|symbol|bigint|Array|Promise|Record|Partial|Required|Pick|Omit|React)\b/g;
const STRINGS = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
const COMMENTS = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
const FUNCTIONS = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;
const NUMBERS = /\b(\d+\.?\d*)\b/g;
const JSX_TAGS = /<\/?([A-Z][a-zA-Z0-9]*)/g;

const tokenize = (code: string): Token[] => {
  const tokens: Token[] = [];
  const matches: { index: number; length: number; type: Token['type']; value: string }[] = [];

  let match;
  
  // Comments first (highest priority)
  const commentRegex = new RegExp(COMMENTS);
  while ((match = commentRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'comment',
      value: match[0]
    });
  }

  // Strings
  const stringRegex = new RegExp(STRINGS);
  while ((match = stringRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'string',
      value: match[0]
    });
  }

  // JSX Tags
  const jsxRegex = new RegExp(JSX_TAGS);
  while ((match = jsxRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'jsx',
      value: match[0]
    });
  }

  // Type Keywords
  const typeRegex = new RegExp(TYPE_KEYWORDS);
  while ((match = typeRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'type',
      value: match[0]
    });
  }

  // Keywords
  const keywordRegex = new RegExp(KEYWORDS);
  while ((match = keywordRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'keyword',
      value: match[0]
    });
  }

  // Functions
  const functionRegex = new RegExp(FUNCTIONS);
  while ((match = functionRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[1].length,
      type: 'function',
      value: match[1]
    });
  }

  // Numbers
  const numberRegex = new RegExp(NUMBERS);
  while ((match = numberRegex.exec(code)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'number',
      value: match[0]
    });
  }

  // Sort by position
  matches.sort((a, b) => a.index - b.index);

  // Remove overlaps (keep first match)
  const filteredMatches: typeof matches = [];
  let lastEnd = 0;
  matches.forEach(m => {
    if (m.index >= lastEnd) {
      filteredMatches.push(m);
      lastEnd = m.index + m.length;
    }
  });

  // Build tokens
  let lastIndex = 0;
  filteredMatches.forEach(m => {
    if (m.index > lastIndex) {
      tokens.push({
        type: 'default',
        value: code.substring(lastIndex, m.index)
      });
    }
    tokens.push({
      type: m.type,
      value: m.value
    });
    lastIndex = m.index + m.length;
  });

  if (lastIndex < code.length) {
    tokens.push({
      type: 'default',
      value: code.substring(lastIndex)
    });
  }

  return tokens;
};

interface SyntaxHighlighterProps {
  code: string;
  showLineNumbers?: boolean;
}

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({ 
  code, 
  showLineNumbers = false 
}) => {
  const tokens = useMemo(() => tokenize(code), [code]);
  
  const lines = useMemo(() => code.split('\n'), [code]);

  if (showLineNumbers) {
    return (
      <View style={styles.container}>
        <View style={styles.lineNumbers}>
          {lines.map((_, index) => (
            <Text key={index} style={styles.lineNumber}>
              {index + 1}
            </Text>
          ))}
        </View>
        <View style={styles.codeContent}>
          <Text style={styles.codeBlock}>
            {tokens.map((token, index) => (
              <Text key={index} style={styles[token.type]}>
                {token.value}
              </Text>
            ))}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Text style={styles.codeBlock}>
      {tokens.map((token, index) => (
        <Text key={index} style={styles[token.type]}>
          {token.value}
        </Text>
      ))}
    </Text>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  lineNumbers: {
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: theme.palette.border,
    marginRight: 12,
  },
  lineNumber: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 22,
    color: theme.palette.text.disabled,
    textAlign: 'right',
    minWidth: 28,
  },
  codeContent: {
    flex: 1,
  },
  codeBlock: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },
  // 🔥 NEON SYNTAX COLORS
  keyword: {
    color: theme.palette.syntax.keyword, // Neon Magenta
    fontWeight: '600',
  },
  string: {
    color: theme.palette.syntax.string, // Neon Türkis
  },
  comment: {
    color: theme.palette.syntax.comment, // Grau
    fontStyle: 'italic',
  },
  function: {
    color: theme.palette.syntax.function, // Neon Gelb
  },
  number: {
    color: theme.palette.syntax.number, // Neon Orange
  },
  operator: {
    color: theme.palette.syntax.operator, // Neon Grün
  },
  type: {
    color: theme.palette.syntax.type, // Neon Blau
    fontWeight: '500',
  },
  jsx: {
    color: theme.palette.primary, // Neon Grün für JSX
    fontWeight: '600',
  },
  default: {
    color: theme.palette.syntax.default, // Standard Text
  },
});

