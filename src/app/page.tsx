"use client";

import ChatPanel from "@/components/ChatPanel";
import Canvas from "@/components/Canvas";

export default function Home() {
  return (
    <div className="flex h-screen">
      <div className="w-[380px] shrink-0">
        <ChatPanel />
      </div>
      <div className="flex-1">
        <Canvas />
      </div>
    </div>
  );
}
