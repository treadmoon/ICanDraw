"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <p className="mb-3 text-4xl">😵</p>
        <h2 className="mb-2 text-lg font-semibold">页面加载出错</h2>
        <p className="mb-4 text-sm text-gray-500">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700"
        >
          重试
        </button>
      </div>
    </div>
  );
}
