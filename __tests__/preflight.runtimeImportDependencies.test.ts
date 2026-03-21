import { applyPatch } from "../lib/diagnostics/patchEngine";
import {
  checkRuntimeImportDependencies,
  findRuntimeDependencyImportMismatches,
} from "../lib/diagnostics/checks/runtimeDependencies";
import type { ProjectFile } from "../shared/types/project";

function makeFiles(packageJson: Record<string, unknown>, extraFiles: ProjectFile[]): ProjectFile[] {
  return [
    {
      path: "package.json",
      content: `${JSON.stringify(packageJson, null, 2)}\n`,
    },
    ...extraFiles,
  ];
}

describe("preflight runtime import dependency mismatches", () => {
  it("detects missing expo-linear-gradient imports", () => {
    const files = makeFiles(
      {
        name: "musik-player",
        dependencies: {
          expo: "~54.0.0",
          react: "19.1.0",
          "react-native": "0.81.0",
        },
      },
      [
        {
          path: "screens/Library.tsx",
          content: 'import { LinearGradient } from "expo-linear-gradient";\nexport default LinearGradient;\n',
        },
      ],
    );

    const result = checkRuntimeImportDependencies.run(files, {
      mode: "eas",
      profile: "preview",
    });

    expect(result.status).toBe("fail");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "expo-linear-gradient",
          category: "missing_runtime_dependency",
          fixability: "autofix",
          importingFiles: ["screens/Library.tsx"],
          versionSuggestion: "~15.0.8",
        }),
      ]),
    );
  });

  it("detects missing expo-blur imports", () => {
    const files = makeFiles(
      {
        name: "musik-player",
        dependencies: {
          expo: "~54.0.0",
          react: "19.1.0",
          "react-native": "0.81.0",
        },
      },
      [
        {
          path: "screens/Library.tsx",
          content: 'import { BlurView } from "expo-blur";\nexport default BlurView;\n',
        },
      ],
    );

    const findings = findRuntimeDependencyImportMismatches(files);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "expo-blur",
          category: "missing_runtime_dependency",
          fixability: "autofix",
          versionSuggestion: "~15.0.7",
        }),
      ]),
    );
  });

  it("does not report already declared runtime dependencies", () => {
    const files = makeFiles(
      {
        name: "musik-player",
        dependencies: {
          expo: "~54.0.0",
          react: "19.1.0",
          "react-native": "0.81.0",
          "expo-linear-gradient": "~15.0.8",
        },
      },
      [
        {
          path: "screens/Library.tsx",
          content: 'import { LinearGradient } from "expo-linear-gradient";\nexport default LinearGradient;\n',
        },
      ],
    );

    const findings = findRuntimeDependencyImportMismatches(files);
    expect(findings).toHaveLength(0);
  });

  it("ignores local relative imports", () => {
    const files = makeFiles(
      {
        name: "musik-player",
        dependencies: {
          expo: "~54.0.0",
          react: "19.1.0",
          "react-native": "0.81.0",
        },
      },
      [
        {
          path: "screens/Library.tsx",
          content: 'import Header from "../components/Header";\nimport utils from "@/utils/local";\nexport default Header;\n',
        },
      ],
    );

    const findings = findRuntimeDependencyImportMismatches(files);
    expect(findings).toHaveLength(0);
  });

  it("autofix adds safe missing expo dependencies to package.json", async () => {
    const files = makeFiles(
      {
        name: "musik-player",
        dependencies: {
          expo: "~54.0.0",
          react: "19.1.0",
          "react-native": "0.81.0",
        },
      },
      [
        {
          path: "screens/Library.tsx",
          content:
            'import { LinearGradient } from "expo-linear-gradient";\nimport { BlurView } from "expo-blur";\nexport default function Library() { return null; }\n',
        },
      ],
    );

    const result = checkRuntimeImportDependencies.run(files, {
      mode: "eas",
      profile: "preview",
    });

    expect(result.fix?.patch?.upsert?.[0]?.path).toBe("package.json");

    const nextFiles = await applyPatch(files, result.fix!.patch!);
    const nextPackageJson = JSON.parse(nextFiles.find((file) => file.path === "package.json")?.content ?? "{}");

    expect(nextPackageJson.dependencies["expo-linear-gradient"]).toBe("~15.0.8");
    expect(nextPackageJson.dependencies["expo-blur"]).toBe("~15.0.7");
  });

  it("autofix reuses exact versions from package-lock.json for missing runtime dependencies", async () => {
    const files = [
      ...makeFiles(
        {
          name: "musik-player",
          dependencies: {
            expo: "~54.0.0",
            react: "19.1.0",
            "react-native": "0.81.0",
          },
        },
        [
          {
            path: "screens/Preview.tsx",
            content:
              'import { GestureHandlerRootView } from "react-native-gesture-handler";\nexport default GestureHandlerRootView;\n',
          },
        ],
      ),
      {
        path: "package-lock.json",
        content: `${JSON.stringify(
          {
            name: "musik-player",
            lockfileVersion: 3,
            packages: {
              "": {
                dependencies: {
                  "react-native-gesture-handler": "~2.28.0",
                },
              },
              "node_modules/react-native-gesture-handler": {
                version: "2.28.0",
              },
            },
          },
          null,
          2,
        )}\n`,
      },
    ];

    const result = checkRuntimeImportDependencies.run(files, {
      mode: "eas",
      profile: "preview",
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "react-native-gesture-handler",
          fixability: "autofix",
          versionSuggestion: "2.28.0",
        }),
      ]),
    );

    const nextFiles = await applyPatch(files, result.fix!.patch!);
    const nextPackageJson = JSON.parse(nextFiles.find((file) => file.path === "package.json")?.content ?? "{}");

    expect(nextPackageJson.dependencies["react-native-gesture-handler"]).toBe("2.28.0");
  });

  it("marks unsupported runtime packages as manual-only diagnostics", () => {
    const files = makeFiles(
      {
        name: "musik-player",
        dependencies: {
          expo: "~54.0.0",
          react: "19.1.0",
          "react-native": "0.81.0",
        },
      },
      [
        {
          path: "screens/Library.tsx",
          content: 'import ViewShot from "react-native-view-shot";\nexport default ViewShot;\n',
        },
      ],
    );

    const result = checkRuntimeImportDependencies.run(files, {
      mode: "eas",
      profile: "preview",
    });

    expect(result.status).toBe("fail");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "react-native-view-shot",
          fixability: "manual",
          category: "missing_runtime_dependency",
          suggestedInstallMethod: "npm install react-native-view-shot",
        }),
      ]),
    );
    expect(result.fix).toBeUndefined();
  });
});
