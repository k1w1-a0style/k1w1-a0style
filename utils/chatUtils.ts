import { jsonrepair } from 'jsonrepair';
import { ProjectFile } from '../contexts/ProjectContext';

export const extractJsonArray = (text: string): string | null => {
  const match = text.match(/```json\s*(\[[\s\S]*\])\s*```|(\[[\s\S]*\])/);
  if (!match) return null;

  const jsonString = match[1] || match[2];
  if (jsonString) {
    console.log(`🔍 JSON gefunden (${jsonString.length} chars)`);
    return jsonString;
  }
  return null;
};

// ============================================================================
// SRC-OPTIMIERTE VALIDIERUNG
// ============================================================================
export const validateProjectFiles = (files: ProjectFile[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Leeres Array ist OK (Agent lehnt ab)
  if (!Array.isArray(files) || files.length === 0) {
    return { valid: true, errors: [] };
  }

  const seenPaths = new Set<string>();

  files.forEach((file, idx) => {
    const fileNum = `Datei ${idx + 1}`;

    // 1. Grundstruktur
    if (!file?.path || typeof file.content === 'undefined') {
      errors.push(`${fileNum}: Ungültige Struktur`);
      return;
    }

    // 2. Duplikate
    if (seenPaths.has(file.path)) {
      errors.push(`${file.path}: DUPLIKAT!`);
    }
    seenPaths.add(file.path);

    // 3. Verbotene Duplikat-Patterns
    if (/README[0-9]|App[0-9]|_copy|_backup|\([0-9]\)/i.test(file.path)) {
      errors.push(`${file.path}: Verbotenes Duplikat-Pattern`);
    }

    // ✅ 4. SRC-ORDNER STRUKTUR VALIDIERUNG
    const isCodeFile = file.path.endsWith('.tsx') || file.path.endsWith('.ts');
    const isRootFile = ['App.tsx', 'theme.ts', 'package.json', 'app.config.js', 'README.md', 'expo-env.d.ts'].includes(file.path);
    
    if (isCodeFile && !isRootFile && !file.path.startsWith('src/')) {
      errors.push(`${file.path}: Sollte in src/ Ordner sein`);
    }

    // 5. Platzhalter-Erkennung (STRIKT!)
    const content = String(file.content);
    const forbiddenPlaceholders = [
      '// ... existing code',
      '// ... rest of',
      '// ... other',
      '/* ... */',
      '// TODO: implement',
      '// Previous code',
      '// Add your code',
      '// Insert code here'
    ];

    forbiddenPlaceholders.forEach(pattern => {
      if (content.includes(pattern)) {
        errors.push(`${file.path}: PLATZHALTER gefunden: "${pattern}"`);
      }
    });

    // 6. GELOCKERTE Mindestlänge für Code-Dateien  
    const isNotConfig = !file.path.includes('types.ts') &&
                       !file.path.includes('theme.ts') &&
                       !file.path.endsWith('.d.ts') &&
                       !file.path.includes('constants.ts');

    if (isCodeFile && isNotConfig) {
      const lines = content.split('\n').length;
      // ✅ NOCH LOCKERER für bessere UX
      const minLines = file.path.endsWith('.tsx') ? 15 : 8; // Vorher: 12/6

      if (lines < minLines) {
        errors.push(`${file.path}: Zu kurz (${lines} Zeilen, MIN ${minLines})`);
      }
    }

    // 7. Basic Import/Export Check für Code-Dateien
    if (isCodeFile && isNotConfig) {
      const hasImports = /^import\s+/m.test(content);
      const hasExport = /export\s+(default|const|function|class)/m.test(content);

      if (!hasImports && !hasExport && content.length > 100) {
        errors.push(`${file.path}: Keine Imports/Exports - verdächtig`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

// ============================================================================
// ERWEITERTE tryParseJsonWithRepair (mit src-Korrektur)
// ============================================================================
export const tryParseJsonWithRepair = (jsonString: string): ProjectFile[] | null => {
  let parsed: any;

  // Versuch 1: Direktes Parsen
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    console.warn('⚠️  JSON Parse Error, versuche Reparatur...');

    // Versuch 2: Erweiterte manuelle Reparatur
    let repairedJson = jsonString;
    
    // Häufiger Fehler: "=" statt ":"
    repairedJson = repairedJson.replace(/"\s*=\s*"/g, '":"');
    repairedJson = repairedJson.replace(/"\s*=\s*/g, '":');
    
    // Häufiger Fehler: Unescaped quotes
    repairedJson = repairedJson.replace(/\\n/g, '\\\\n');
    
    // Häufiger Fehler: Trailing commas
    repairedJson = repairedJson.replace(/,(\s*[}\]])/g, '$1');
    
    try {
      parsed = JSON.parse(repairedJson);
      console.log('✅ JSON manuell repariert');
    } catch (e2) {
      // Versuch 3: jsonrepair als letzter Ausweg
      try {
        const repaired = jsonrepair(repairedJson);
        parsed = JSON.parse(repaired);
        console.log('✅ JSON mit jsonrepair repariert');
      } catch (repairError) {
        console.error('❌ JSON Reparatur fehlgeschlagen:', repairError);
        return null;
      }
    }
  }

  // Basis-Check
  if (!Array.isArray(parsed)) {
    console.error('❌ Kein Array empfangen');
    return null;
  }

  // Leeres Array = Agent hat abgelehnt (OK!)
  if (parsed.length === 0) {
    console.log('⚠️  Leeres Array (Agent-Ablehnung)');
    return [];
  }

  // ✅ SRC-ORDNER AUTO-KORREKTUR
  const files: ProjectFile[] = parsed.map((file) => {
    let correctedPath = file.path;
    
    // Auto-Korrektur: Verschiebe Code-Dateien in src/ wenn nicht schon drin
    const isCodeFile = correctedPath.endsWith('.tsx') || correctedPath.endsWith('.ts');
    const isRootFile = ['App.tsx', 'theme.ts', 'package.json', 'app.config.js', 'README.md', 'expo-env.d.ts'].includes(correctedPath);
    
    if (isCodeFile && !isRootFile && !correctedPath.startsWith('src/')) {
      if (correctedPath.startsWith('components/')) {
        correctedPath = `src/${correctedPath}`;
      } else if (correctedPath.startsWith('screens/')) {
        correctedPath = `src/${correctedPath}`;
      } else if (correctedPath.startsWith('contexts/')) {
        correctedPath = `src/${correctedPath}`;
      } else if (correctedPath.startsWith('hooks/')) {
        correctedPath = `src/${correctedPath}`;
      } else if (correctedPath.startsWith('utils/')) {
        correctedPath = `src/${correctedPath}`;
      } else if (correctedPath.includes('Component') || correctedPath.includes('Screen')) {
        // Unklare Dateien in components/
        correctedPath = `src/components/${correctedPath}`;
      }
      
      console.log(`🔧 Auto-Korrektur: ${file.path} → ${correctedPath}`);
    }

    return {
      ...file,
      path: correctedPath,
      content: typeof file.content === 'string'
        ? file.content
        : JSON.stringify(file.content ?? '', null, 2),
    };
  });

  // ✅ Validierung
  const validation = validateProjectFiles(files);

  if (!validation.valid) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ VALIDIERUNG FEHLGESCHLAGEN:');
    validation.errors.forEach((err, idx) => {
      console.error(`  ${idx + 1}. ${err}`);
    });
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return null;
  }

  console.log(`✅ Validierung OK: ${files.length} Dateien`);
  return files;
};
