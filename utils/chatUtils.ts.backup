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

export const tryParseJsonWithRepair = (jsonString: string): ProjectFile[] | null => {
  try {
    return JSON.parse(jsonString) as ProjectFile[];
  } catch (e) {
    try {
      const repaired = jsonrepair(jsonString);
      const result = JSON.parse(repaired);
      
      if (
        Array.isArray(result) &&
        (result.length === 0 ||
          (result[0]?.path && typeof result[0].content !== 'undefined'))
      ) {
        console.log('✅ JSON repariert');
        return result.map((file) => ({
          ...file,
          content:
            typeof file.content === 'string'
              ? file.content
              : JSON.stringify(file.content ?? '', null, 2),
        }));
      } else {
        console.warn('⚠️ JSON repariert, aber Format ungültig');
        return null;
      }
    } catch (error) {
      console.error('❌ JSON Parse fehlgeschlagen:', error);
      return null;
    }
  }
};
