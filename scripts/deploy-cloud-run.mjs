// 部署網站到 Google Cloud Run（台灣機房 asia-east1）。
// 用法：pnpm deploy:cloud-run [正式網址]
//   例如 pnpm deploy:cloud-run https://learn.marsen.me
//   不給網址：先用 Cloud Run 給的 *.run.app 網址
// - 環境變數從 .env.local 讀（不含本機專用的 AUDIO_LOCAL_DIR），寫到暫存檔交給 gcloud，不進 Git
// - 用目前 gcloud 設定的專案；要換專案先執行 gcloud config set project <專案 id>
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SERVICE = "learn-english";
const REGION = "asia-east1";

const REQUIRED = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_TOKEN_TTL",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
];
const OPTIONAL = ["AUDIO_CDN_BASE", "AUDIO_PASS_SECRET"];

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", ...opts }).trim();

// 讀 .env.local（KEY=VALUE；忽略註解與空行；去掉成對的引號）
const vars = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (!m) continue;
  vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}
const missing = REQUIRED.filter((k) => !vars[k]);
if (missing.length > 0) {
  console.error(`[deploy] .env.local 缺少：${missing.join("、")}（正式環境一定要有）`);
  process.exit(1);
}

const project = sh("gcloud config get-value project");
if (!project) {
  console.error("[deploy] 還沒設定 GCP 專案：gcloud config set project <專案 id>");
  process.exit(1);
}

// 服務已經存在：沿用它現在的 SITE_URL（接了自己的網域後，不會被改回 run.app 網址）
const existing = (() => {
  try {
    const svc = JSON.parse(
      sh(`gcloud run services describe ${SERVICE} --region ${REGION} --format json`, {
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
    const envs = svc.spec?.template?.spec?.containers?.[0]?.env ?? [];
    return {
      url: svc.status?.url ?? "",
      siteUrl: envs.find((e) => e.name === "SITE_URL")?.value ?? "",
    };
  } catch {
    return null;
  }
})();
const siteUrl =
  process.argv[2] ||
  (existing?.siteUrl && !existing.siteUrl.includes(".invalid") ? existing.siteUrl : "") ||
  existing?.url ||
  "https://pending.invalid";

const env = { SITE_URL: siteUrl };
for (const k of [...REQUIRED, ...OPTIONAL]) if (vars[k]) env[k] = vars[k];

const dir = mkdtempSync(join(tmpdir(), "learn-english-"));
const envFile = join(dir, "env.yaml");
writeFileSync(
  envFile,
  Object.entries(env)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n") + "\n",
);

console.log(`專案：${project}　服務：${SERVICE}　地區：${REGION}　網址：${siteUrl}`);
try {
  execSync(
    [
      `gcloud run deploy ${SERVICE}`,
      "--source .",
      `--region ${REGION}`,
      "--allow-unauthenticated",
      `--env-vars-file "${envFile}"`,
      "--memory 512Mi --cpu 1",
      // 沒人用時關掉（不收費）；最多 3 台，避免被灌爆時費用失控
      "--min-instances 0 --max-instances 3",
      "--timeout 60",
    ].join(" "),
    { stdio: "inherit" },
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// 第一次部署沒給網址：換成 Cloud Run 給的網址（登入信的連結要用）
if (!process.argv[2] && !existing) {
  const url = sh(
    `gcloud run services describe ${SERVICE} --region ${REGION} --format "value(status.url)"`,
  );
  console.log(`設定 SITE_URL=${url} …`);
  execSync(
    `gcloud run services update ${SERVICE} --region ${REGION} --update-env-vars SITE_URL=${url}`,
    { stdio: "inherit" },
  );
  console.log(`完成：${url}`);
} else {
  console.log(`完成：${siteUrl}`);
}
