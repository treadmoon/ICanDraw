export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-3 h-10 w-10 mx-auto animate-spin rounded-full border-3 border-gray-200 border-t-blue-500" />
        <p className="text-sm text-gray-400">加载中...</p>
      </div>
    </div>
  );
}
