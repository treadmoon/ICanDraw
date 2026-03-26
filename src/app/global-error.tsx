"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>😵</p>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>应用出了点问题</h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>{error.message}</p>
            <button
              onClick={reset}
              style={{ padding: "8px 24px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}
            >
              重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
