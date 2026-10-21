/** 首頁用的線條圖示 */
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function HeadphonesIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </svg>
  );
}

const paths: Record<string, React.ReactNode> = {
  repeat: (
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </>
  ),
};

export function FeatureIcon({ name }: { name: string }) {
  return (
    <svg {...base} className="h-6 w-6">
      {paths[name]}
    </svg>
  );
}

export function Wave({
  paused = false,
  className = "",
}: {
  paused?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`wave inline-flex h-6 items-center gap-1 ${paused ? "paused" : ""} ${className}`}
    >
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
