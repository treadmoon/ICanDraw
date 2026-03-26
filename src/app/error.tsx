"use client";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <p className="mb-3 text-4xl">😵</p>
        <h2 className="mb-2 text-lg font-semibold">页面加载出错</h2>
        <p className="mb-4 text-sm text-gray-500">请尝试刷新页面</p>
        <button
          onClick={() => unstable_retry()}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700"
        >
          重试
        </button>
      </div>
    </div>
  );
}
