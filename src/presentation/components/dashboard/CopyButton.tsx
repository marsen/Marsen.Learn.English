"use client";

import { useState } from "react";
import { Button } from "@/presentation/components/ui/Button";

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
    <Button variant="secondary" size="sm" onClick={copy}>
      {copied ? "已複製 ✓" : label}
    </Button>
  );
}
