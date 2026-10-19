import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import boundaries from "eslint-plugin-boundaries";

/**
 * 分層規則（依賴方向）：app → presentation → application → domain ← infrastructure
 * 寫錯方向的 import 會直接讓 lint 失敗，架構不靠人記。
 */
const layers = {
  plugins: { boundaries },
  settings: {
    "import/resolver": { typescript: { alwaysTryTypes: true } },
    "boundaries/include": ["src/**/*"],
    // 測試檔可以跨層組裝（例如 application 測試用記憶體 repository）；proxy.ts 是 Next.js 規定的位置
    "boundaries/ignore": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/proxy.ts"],
    "boundaries/elements": [
      { type: "domain", pattern: "src/domain/**", partialMatch: false },
      { type: "application", pattern: "src/application/**", partialMatch: false },
      { type: "infrastructure", pattern: "src/infrastructure/**", partialMatch: false },
      { type: "presentation", pattern: "src/presentation/**", partialMatch: false },
      { type: "app", pattern: "src/app/**", partialMatch: false },
    ],
  },
  rules: {
    "boundaries/no-unknown-files": 2,
    "boundaries/dependencies": [
      2,
      {
        default: "disallow",
        policies: [
          // domain：只能用 domain 自己（外部套件另由下方 domainPure 擋）
          {
            from: { element: { type: "domain" } },
            allow: { to: { element: { type: "domain" } } },
          },
          // application：domain + application
          {
            from: { element: { type: "application" } },
            allow: { to: { element: { types: { anyOf: ["domain", "application"] } } } },
          },
          // infrastructure：實作 domain/application 定義的 port
          {
            from: { element: { type: "infrastructure" } },
            allow: {
              to: {
                element: {
                  types: { anyOf: ["domain", "application", "infrastructure"] },
                },
              },
            },
          },
          // presentation：畫面元件，可用 application 的結果型別與 domain 的型別
          {
            from: { element: { type: "presentation" } },
            allow: {
              to: {
                element: { types: { anyOf: ["domain", "application", "presentation"] } },
              },
            },
          },
          // app：路由與 Server Action，負責把各層組起來
          {
            from: { element: { type: "app" } },
            allow: {
              to: {
                element: {
                  types: {
                    anyOf: [
                      "domain",
                      "application",
                      "infrastructure",
                      "presentation",
                      "app",
                    ],
                  },
                },
              },
            },
          },
        ],
      },
    ],
  },
};

// domain 必須是純 TypeScript：不能 import 任何外部套件（next、react、drizzle、zod…）
const domainPure = {
  files: ["src/domain/**/*.ts"],
  ignores: ["src/domain/**/*.test.ts"],
  rules: {
    "no-restricted-imports": [
      2,
      {
        patterns: [
          {
            regex: "^(?!@/domain/|\\./|\\.\\./).*",
            message: "domain 只能 import domain 自己的檔案，不能用外部套件或其他層",
          },
        ],
      },
    ],
  },
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  layers,
  domainPure,
  // App Router 專案沒有 pages/，關掉只適用 pages/ 的規則
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "legacy/**",
    "drizzle/**",
  ]),
]);
