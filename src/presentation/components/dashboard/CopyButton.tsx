"use client";

import { useState } from "react";

/** 複製一段文字到剪貼簿（例如老師的回饋，貼給 AI） */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" onClick={copy} className="btn-ghost">
      {copied ? "已複製 ✓" : label}
    </button>
  );
}
