/**
 * Task Engine — 任务编排、执行、重试、暂存/继续/重启
 *
 * 设计原则：任务为向导，不是 AI 结果为向导。
 * 每个用户请求被拆成若干子任务，引擎管理生命周期。
 */

import { create } from "zustand";

// ============================================================
// Types
// ============================================================

export type TaskStatus =
  | "pending"    // 等待执行
  | "running"    // 执行中
  | "done"       // 完成
  | "failed"     // 失败（已耗尽重试）
  | "paused"     // 用户暂停
  | "cancelled"; // 用户取消

export interface TaskDef {
  id: string;
  name: string;
  execute: (input: unknown, signal: AbortSignal) => Promise<unknown>;
  buildInput: (prevResults: Map<string, unknown>) => unknown;
  skippable?: boolean;
}

export interface TaskState {
  id: string;
  name: string;
  status: TaskStatus;
  retries: number;
  maxRetries: number;
  error: string | null;
  output: unknown | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export type PipelineStatus =
  | "idle"
  | "running"
  | "paused"       // 用户暂停 or 等待人工介入
  | "done"
  | "failed"
  | "waiting_user"; // 任务失败 3 次，等用户决定

export interface PipelineState {
  // Pipeline identity
  pipelineId: string | null;

  // Task definitions & state
  tasks: TaskState[];
  currentTaskIndex: number;
  status: PipelineStatus;

  // Accumulated results
  results: Record<string, unknown>;

  // User intervention context
  failedTaskId: string | null;
  failedError: string | null;

  // Actions
  init: (pipelineId: string, taskDefs: TaskDef[]) => void;
  reset: () => void;

  // Engine control (called by runner)
  setTaskStatus: (taskId: string, status: TaskStatus, error?: string | null, output?: unknown) => void;
  setTaskRetry: (taskId: string, retries: number) => void;
  setPipelineStatus: (status: PipelineStatus) => void;
  setCurrentTask: (index: number) => void;
  setResult: (taskId: string, output: unknown) => void;
  setWaitingUser: (taskId: string, error: string) => void;
}

const MAX_RETRIES = 3;

const initialState = {
  pipelineId: null,
  tasks: [] as TaskState[],
  currentTaskIndex: 0,
  status: "idle" as PipelineStatus,
  results: {} as Record<string, unknown>,
  failedTaskId: null,
  failedError: null,
};

export const useTaskStore = create<PipelineState>((set) => ({
  ...initialState,

  init: (pipelineId, taskDefs) =>
    set({
      ...initialState,
      pipelineId,
      status: "running",
      tasks: taskDefs.map((t) => ({
        id: t.id,
        name: t.name,
        status: "pending",
        retries: 0,
        maxRetries: MAX_RETRIES,
        error: null,
        output: null,
        startedAt: null,
        finishedAt: null,
      })),
    }),

  reset: () => set(initialState),

  setTaskStatus: (taskId, status, error = null, output = null) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              error,
              output: output ?? t.output,
              startedAt: status === "running" ? Date.now() : t.startedAt,
              finishedAt: status === "done" || status === "failed" ? Date.now() : t.finishedAt,
            }
          : t
      ),
    })),

  setTaskRetry: (taskId, retries) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, retries } : t)),
    })),

  setPipelineStatus: (status) => set({ status }),

  setCurrentTask: (index) => set({ currentTaskIndex: index }),

  setResult: (taskId, output) =>
    set((s) => ({ results: { ...s.results, [taskId]: output } })),

  setWaitingUser: (taskId, error) =>
    set({ status: "waiting_user", failedTaskId: taskId, failedError: error }),
}));

// ============================================================
// Pipeline Runner
// ============================================================

export class PipelineRunner {
  private taskDefs: TaskDef[] = [];
  private abortController: AbortController | null = null;
  private paused = false;
  private pauseResolve: (() => void) | null = null;

  /**
   * Start a new pipeline
   */
  async run(pipelineId: string, taskDefs: TaskDef[]): Promise<void> {
    this.taskDefs = taskDefs;
    this.paused = false;
    this.abortController = new AbortController();

    const store = useTaskStore.getState();
    store.init(pipelineId, taskDefs);

    const results = new Map<string, unknown>();

    for (let i = 0; i < taskDefs.length; i++) {
      // Check if paused
      if (this.paused) {
        await new Promise<void>((resolve) => {
          this.pauseResolve = resolve;
        });
      }

      // Check if cancelled
      if (this.abortController.signal.aborted) {
        useTaskStore.getState().setPipelineStatus("failed");
        return;
      }

      const task = taskDefs[i];
      useTaskStore.getState().setCurrentTask(i);
      useTaskStore.getState().setTaskStatus(task.id, "running");

      let success = false;
      let lastError = "";

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        useTaskStore.getState().setTaskRetry(task.id, attempt);

        try {
          const input = task.buildInput(results);
          const output = await task.execute(input, this.abortController.signal);

          // Success
          results.set(task.id, output);
          useTaskStore.getState().setResult(task.id, output);
          useTaskStore.getState().setTaskStatus(task.id, "done", null, output);
          success = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);

          if (this.abortController.signal.aborted) {
            useTaskStore.getState().setTaskStatus(task.id, "cancelled", "已取消");
            useTaskStore.getState().setPipelineStatus("failed");
            return;
          }

          if (attempt < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s, 4s
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          }
        }
      }

      if (!success) {
        useTaskStore.getState().setTaskStatus(task.id, "failed", lastError);

        if (task.skippable) {
          // Skippable task — continue with null result
          results.set(task.id, null);
          useTaskStore.getState().setResult(task.id, null);
          continue;
        }

        // Non-skippable: ask user what to do
        useTaskStore.getState().setWaitingUser(task.id, lastError);

        // Wait for user decision
        const decision = await this.waitForUserDecision();

        if (decision === "retry") {
          i--; // Retry this task
          continue;
        } else if (decision === "skip") {
          results.set(task.id, null);
          useTaskStore.getState().setResult(task.id, null);
          continue;
        } else {
          // abort
          useTaskStore.getState().setPipelineStatus("failed");
          return;
        }
      }
    }

    useTaskStore.getState().setPipelineStatus("done");
  }

  /**
   * Pause the pipeline
   */
  pause(): void {
    this.paused = true;
    useTaskStore.getState().setPipelineStatus("paused");
  }

  /**
   * Resume a paused pipeline
   */
  resume(): void {
    this.paused = false;
    useTaskStore.getState().setPipelineStatus("running");
    this.pauseResolve?.();
    this.pauseResolve = null;
  }

  /**
   * Cancel the pipeline
   */
  cancel(): void {
    this.abortController?.abort();
    this.pauseResolve?.(); // unblock if paused
    useTaskStore.getState().setPipelineStatus("failed");
  }

  // --- User decision for failed tasks ---

  private userDecisionResolve: ((decision: "retry" | "skip" | "abort") => void) | null = null;

  private waitForUserDecision(): Promise<"retry" | "skip" | "abort"> {
    return new Promise((resolve) => {
      this.userDecisionResolve = resolve;
    });
  }

  /** Called by UI when user makes a decision on a failed task */
  userDecide(decision: "retry" | "skip" | "abort"): void {
    useTaskStore.getState().setPipelineStatus("running");
    this.userDecisionResolve?.(decision);
    this.userDecisionResolve = null;
  }
}

// Singleton runner instance
export const pipelineRunner = new PipelineRunner();
