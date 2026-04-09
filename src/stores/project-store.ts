import { create } from "zustand";
import type { RepoInfo, FileNode, ModuleGraph } from "@/types";

type AnalysisStatus = "idle" | "analyzing" | "done" | "error";

interface AnalysisStep {
  step: number;
  description: string;
  findings: string[];
  status: "pending" | "in_progress" | "done" | "failed";
}

interface DiagramProgress {
  index: number;
  total: number;
  diagramType: string;
  title: string;
  status: "pending" | "generating" | "done" | "failed";
}

interface ProjectStore {
  // Current project info
  repoInfo: RepoInfo | null;
  fileTree: FileNode[];

  // Analysis state
  status: AnalysisStatus;
  error: string | null;
  progress: string;
  currentStep: number;
  totalSteps: number;

  // Incremental results
  steps: AnalysisStep[];
  moduleGraph: ModuleGraph;
  summary: string;
  insights: string[];

  // Diagram progress
  diagrams: DiagramProgress[];

  // Actions
  setRepoInfo: (info: RepoInfo) => void;
  setFileTree: (tree: FileNode[]) => void;
  setStatus: (status: AnalysisStatus, progress?: string) => void;
  setError: (error: string) => void;
  reset: () => void;

  // SSE update methods
  addStep: (step: number, description: string) => void;
  updateStepProgress: (step: number, message: string) => void;
  completeStep: (step: number, findings: string[], moduleGraph: ModuleGraph) => void;
  failStep: (step: number, error: string) => void;
  setDiagramsReady: (summary: string, insights: string[]) => void;
  addDiagram: (diagram: DiagramProgress) => void;
  completeDiagram: (index: number) => void;
  failDiagram: (index: number) => void;
}

const initialState = {
  repoInfo: null,
  fileTree: [],
  status: "idle" as AnalysisStatus,
  error: null,
  progress: "",
  currentStep: 0,
  totalSteps: 0,
  steps: [] as AnalysisStep[],
  moduleGraph: { nodes: [], edges: [] } as ModuleGraph,
  summary: "",
  insights: [] as string[],
  diagrams: [] as DiagramProgress[],
};

export const useProjectStore = create<ProjectStore>((set) => ({
  ...initialState,

  setRepoInfo: (info) => set({ repoInfo: info }),

  setFileTree: (tree) => set({ fileTree: tree }),

  setStatus: (status, progress = "") =>
    set({ status, progress: progress || "" }),

  setError: (error) => set({ error, status: "error" }),

  reset: () => set(initialState),

  addStep: (step, description) =>
    set((s) => ({
      steps: [...s.steps, { step, description, findings: [], status: "in_progress" }],
      currentStep: step,
      totalSteps: Math.max(s.totalSteps, step),
    })),

  updateStepProgress: (step, message) =>
    set((s) => ({
      progress: message,
    })),

  completeStep: (step, findings, moduleGraph) =>
    set((s) => {
      const steps = s.steps.map((st) =>
        st.step === step ? { ...st, findings, status: "done" as const } : st
      );
      const allFindings = [...s.insights, ...findings].slice(0, 10);
      return {
        steps,
        insights: allFindings,
        moduleGraph: {
          nodes: [...s.moduleGraph.nodes, ...(moduleGraph?.nodes ?? [])],
          edges: [...s.moduleGraph.edges, ...(moduleGraph?.edges ?? [])],
        },
      };
    }),

  failStep: (step, error) =>
    set((s) => ({
      steps: s.steps.map((st) =>
        st.step === step ? { ...st, status: "failed" as const } : st
      ),
      error,
    })),

  setDiagramsReady: (summary, insights) =>
    set({ summary, insights, status: "done" }),

  addDiagram: (diagram) =>
    set((s) => ({
      diagrams: [...s.diagrams, diagram],
    })),

  completeDiagram: (index) =>
    set((s) => ({
      diagrams: s.diagrams.map((d) =>
        d.index === index ? { ...d, status: "done" as const } : d
      ),
    })),

  failDiagram: (index) =>
    set((s) => ({
      diagrams: s.diagrams.map((d) =>
        d.index === index ? { ...d, status: "failed" as const } : d
      ),
    })),
}));
