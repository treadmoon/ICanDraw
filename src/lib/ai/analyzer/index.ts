/**
 * AI Analyzer - Multi-Agent Orchestration Pipeline
 *
 * Phase 1: Intent Agent - Understand project and create profile
 * Phase 2: Module Agents - Analyze specific aspects step by step
 * Phase 3: Synthesizer Agent - Create final diagrams
 */

export { runIntentAgent } from "./intent";
export type { ProjectProfile, AnalysisPlanItem } from "./intent";

export { runModuleAnalysis, fetchAnalysisFiles } from "./modules";
export type { ModuleAnalysisResult, DiagramSpec } from "./modules";

export { runSynthesizerAgent, convertToExcalidrawElements } from "./synthesizer";

export { summarizeFileContent, selectKeyFiles } from "./context-manager";
