import { useTranslations } from "next-intl";
import { ButtonLink } from "@/presentation/components/ui/Button";
import { LanguageSwitcher } from "@/presentation/components/LanguageSwitcher";

/** 路人（沒登入）看考卷時的上方列：品牌、語言、登入（手機上登入按鈕用短的字） */
export function GuestBar({
  setLocale,
}: {
  setLocale: (locale: string) => Promise<void>;
}) {
  const t = useTranslations();
  return (
    <header className="border-b border-border bg-background/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2 sm:px-5">
        <a href="/" className="min-w-0 font-semibold leading-tight text-heading">
          {t("common.brand")}
        </a>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <LanguageSwitcher setLocale={setLocale} />
          <ButtonLink href="/login" size="sm">
            <span className="sm:hidden">{t("nav.login")}</span>
            <span className="hidden sm:inline">{t("nav.loginOrSignup")}</span>
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
