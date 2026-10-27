"use client";

import { useTranslations } from "next-intl";
import { LANDING as L } from "@/presentation/content/landing";
import { Reveal } from "@/presentation/components/Reveal";
import { DemoQuestion } from "./DemoQuestion";
import { FeatureIcon } from "./icons";
import { LandingNav } from "./LandingNav";

const cta = "rounded-full px-7 py-3.5 font-medium transition hover:scale-105 shadow-sm";

/** 首頁（Landing Page）。文字在翻譯檔 landing.*，結構在 presentation/content/landing.ts。 */
export function LandingPage({
  examHref,
  loginHref,
  dashboardHref,
}: {
  examHref: string;
  loginHref: string;
  /** 已登入時給：導覽列改成「我的總覽」「開始練習」 */
  dashboardHref?: string;
}) {
  const t = useTranslations("landing");
  const brand = useTranslations("common")("brand");
  return (
    <>
      <LandingNav
        examHref={examHref}
        loginHref={loginHref}
        dashboardHref={dashboardHref}
      />
      <main id="top">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
          <Reveal>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-soft/70 px-3 py-1 text-sm text-primary-hover">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {t("hero.badge")}
            </p>
            <h1 className="text-4xl leading-tight font-bold md:text-5xl">
              {t("hero.titleLine1")}
              <br />
              {t("hero.titleLine2")}
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              {t("hero.lead")}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href={examHref}
                className={`${cta} bg-primary text-primary-foreground hover:bg-primary-hover`}
              >
                {t("hero.cta")}
              </a>
              <a
                href="#demo"
                className="rounded-full px-5 py-3.5 font-medium text-heading transition hover:bg-primary-soft/60"
              >
                {t("hero.secondary")}
              </a>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">{t("hero.note")}</p>
          </Reveal>

          {/* 插圖佔位 */}
          <Reveal>
            <div className="relative mx-auto aspect-square w-full max-w-md rounded-[2rem] border-2 border-dashed border-primary/40 bg-gradient-to-br from-card to-primary-soft/40 p-8">
              <div className="absolute -top-3 -right-3 rotate-6 rounded-2xl bg-surface px-4 py-2 text-sm text-muted-foreground shadow-sm">
                🎧 {t("hero.playingTag")}
              </div>
              <div className="flex h-full flex-col items-center justify-center text-center">
                <svg
                  viewBox="0 0 120 120"
                  className="h-32 w-32 text-primary/70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={4}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M22 70v-8a38 38 0 0 1 76 0v8" />
                  <rect
                    x="14"
                    y="68"
                    width="20"
                    height="30"
                    rx="8"
                    className="fill-primary-soft"
                  />
                  <rect
                    x="86"
                    y="68"
                    width="20"
                    height="30"
                    rx="8"
                    className="fill-primary-soft"
                  />
                  <circle cx="48" cy="58" r="3" className="fill-primary" stroke="none" />
                  <circle cx="72" cy="58" r="3" className="fill-primary" stroke="none" />
                  <path d="M52 70q8 6 16 0" />
                </svg>
                <p className="mt-6 text-sm font-medium text-primary-hover">
                  {t("hero.illustration")}
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* 特色 */}
        <section id="features" className="bg-surface/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold">{t("features.title")}</h2>
              <p className="mt-4 text-muted-foreground">{t("features.lead")}</p>
            </Reveal>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {L.features.map((f) => (
                <Reveal
                  as="article"
                  key={f.key}
                  className="rounded-3xl border border-border bg-background p-7"
                >
                  <div
                    className={`mb-5 grid h-12 w-12 place-items-center rounded-2xl ${
                      f.tone === "accent"
                        ? "bg-accent-soft text-accent-hover"
                        : "bg-primary-soft text-primary-hover"
                    }`}
                  >
                    <FeatureIcon name={f.icon} />
                  </div>
                  <h3 className="font-semibold">{t(`features.items.${f.key}.title`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`features.items.${f.key}.body`)}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 怎麼練 */}
        <section id="how" className="py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-5">
            <Reveal>
              <h2 className="text-center text-3xl font-bold">{t("steps.title")}</h2>
            </Reveal>
            <ol className="mt-14 grid gap-10 md:grid-cols-3">
              {L.steps.map((s, i) => (
                <Reveal as="li" key={s} className="text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 font-semibold">{t(`steps.items.${s}.title`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`steps.items.${s}.body`)}
                  </p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* 試做一題 */}
        <section id="demo" className="bg-surface/60 py-20 md:py-24">
          <div className="mx-auto max-w-3xl px-5">
            <Reveal className="text-center">
              <h2 className="text-3xl font-bold">{t("demo.title")}</h2>
              <p className="mt-4 text-muted-foreground">{t("demo.lead")}</p>
            </Reveal>
            <Reveal className="mt-12">
              <DemoQuestion />
            </Reveal>
          </div>
        </section>

        {/* 常見問題 */}
        <section id="faq" className="py-20 md:py-24">
          <div className="mx-auto max-w-3xl px-5">
            <Reveal>
              <h2 className="text-center text-3xl font-bold">{t("faq.title")}</h2>
            </Reveal>
            <div className="mt-12 space-y-3">
              {L.faq.map((f) => (
                <Reveal key={f}>
                  <details className="group rounded-2xl border border-border bg-surface px-6 py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-heading">
                      {t(`faq.items.${f}.q`)}
                      <span className="text-primary transition group-open:rotate-45">
                        ＋
                      </span>
                    </summary>
                    <p className="mt-3 text-muted-foreground">{t(`faq.items.${f}.a`)}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 最後 CTA */}
        <section className="px-5 pb-24">
          <Reveal className="mx-auto max-w-4xl rounded-[2rem] bg-gradient-to-br from-primary-soft via-card to-accent-soft px-8 py-16 text-center">
            <h2 className="text-3xl font-bold">{t("finalCta.title")}</h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              {t("finalCta.lead")}
            </p>
            <a
              href={examHref}
              className={`mt-10 inline-block ${cta} bg-accent text-accent-foreground hover:bg-accent-hover`}
            >
              {t("finalCta.cta")}
            </a>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        <p>{t("footer.disclaimer")}</p>
        <p className="mt-2">© {brand}</p>
      </footer>
    </>
  );
}
