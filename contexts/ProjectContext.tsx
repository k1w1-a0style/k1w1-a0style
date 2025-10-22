import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Alert } from 'react-native';

// --- 1. Zentrale Datenstruktur ---
// Definiert, wie eine Datei in unserem Projekt-State aussieht
export type ProjectFile = {
  path: string; // z.B. "src/components/Button.tsx"
  content: string; // Der Quellcode
};

// --- 2. Testdaten (Platzhalter) ---
// Ein Dummy-Projekt, damit die App beim Start nicht leer ist.
// Das wird später von der KI überschrieben.
const DUMMY_PROJECT: ProjectFile[] = [
  {
    path: 'package.json',
    content: `{
  "name": "meine-neue-app",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "expo": "~54.0.0",
    "react": "18.2.0",
    "react-native": "0.81.0"
  }
}`
  },
  {
    path: 'app.config.js',
    content: `module.exports = {
  expo: {
    name: "meine-neue-app",
    slug: "meine-neue-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
  }
};`
  },
  {
    path: 'src/App.tsx',
    content: `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Hallo Welt!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});`
  },
];


// --- 3. Context Typ ---
// Was der Context alles können muss:
interface ProjectContextProps {
  projectFiles: ProjectFile[]; // Die Liste aller Dateien
  setProjectFiles: (files: ProjectFile[]) => void; // Funktion, um das ganze Projekt zu überschreiben
  // Später könnten wir hinzufügen:
  // updateFileContent: (path: string, newContent: string) => void;
  // addFile: (path: string, content: string) => void;
}

// --- 4. Context erstellen ---
const ProjectContext = createContext<ProjectContextProps | undefined>(undefined);

// --- 5. Provider Komponente ---
// Diese Komponente stellt den State (die Dateien) bereit
export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>(DUMMY_PROJECT);

  // Die Funktion, die wir dem Context geben
  const handleSetProjectFiles = (files: ProjectFile[]) => {
    // Hier könnten wir Validierung einbauen
    if (files && files.length > 0) {
      setProjectFiles(files);
      console.log(`ProjectContext: Projekt mit ${files.length} Dateien aktualisiert.`);
      // Alert.alert("Projekt geladen", `Neues Projekt mit ${files.length} Dateien geladen.`);
    } else {
      console.warn("ProjectContext: Versuch, leeres Projekt zu setzen.");
    }
  };

  const value = {
    projectFiles,
    setProjectFiles: handleSetProjectFiles,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

// --- 6. Hook ---
// Damit greifen unsere Screens einfach auf den Context zu
export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject muss innerhalb eines ProjectProvider verwendet werden');
  }
  return context;
};

