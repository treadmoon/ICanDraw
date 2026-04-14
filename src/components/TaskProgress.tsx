"use client";

import { useTaskStore, pipelineRunner } from "@/stores/task-engine";

const STATUS_ICON: Record<string, string> = {
  pending: "⏳",
  running: "🔄",
  done: "✅",
  failed: "❌",
  paused: "⏸️",
  cancelled: "🚫",
};

export default function TaskProgress() {
  const tasks = useTaskStore((s) => s.tasks);
  const status = useTaskStore((s) => s.status);
  const failedTaskId = useTaskStore((s) => s.failedTaskId);
  const failedError = useTaskStore((s) => s.failedError);

  if (tasks.length === 0) return null;

  return (
    <div className="mx-2 mb-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
      {/* Task list */}
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2">
            <span className="w-4 text-center">
              {task.status === "running" ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent" />
              ) : (
                STATUS_ICON[task.status] ?? "⏳"
              )}
            </span>
            <span className={task.status === "done" ? "text-gray-400 line-through" : "text-gray-700 dark:text-gray-300"}>
              {task.name}
            </span>
            {task.retries > 1 && task.status === "running" && (
              <span className="text-amber-500">重试 {task.retries}/{task.maxRetries}</span>
            )}
            {task.status === "failed" && task.error && (
              <span className="text-red-500 truncate max-w-[160px]" title={task.error}>
                {task.error}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* User intervention panel */}
      {status === "waiting_user" && failedTaskId && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-2 text-amber-800 dark:text-amber-200">
            「{tasks.find((t) => t.id === failedTaskId)?.name}」重试 3 次仍失败
          </p>
          {failedError && (
            <p className="mb-2 text-amber-600 dark:text-amber-400 truncate" title={failedError}>
              原因：{failedError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => pipelineRunner.userDecide("retry")}
              className="rounded-lg bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
            >
              再试一次
            </button>
            <button
              onClick={() => pipelineRunner.userDecide("skip")}
              className="rounded-lg bg-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            >
              跳过此步
            </button>
            <button
              onClick={() => pipelineRunner.userDecide("abort")}
              className="rounded-lg bg-red-100 px-3 py-1 text-red-600 hover:bg-red-200 dark:bg-red-900 dark:text-red-300"
            >
              终止
            </button>
          </div>
        </div>
      )}

      {/* Pipeline controls */}
      {(status === "running" || status === "paused") && (
        <div className="mt-2 flex gap-2 border-t border-gray-200 pt-2 dark:border-gray-700">
          {status === "running" ? (
            <button
              onClick={() => pipelineRunner.pause()}
              className="rounded px-2 py-0.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            >
              ⏸ 暂停
            </button>
          ) : (
            <button
              onClick={() => pipelineRunner.resume()}
              className="rounded px-2 py-0.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
            >
              ▶ 继续
            </button>
          )}
          <button
            onClick={() => pipelineRunner.cancel()}
            className="rounded px-2 py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
          >
            ✕ 取消
          </button>
        </div>
      )}
    </div>
  );
}
