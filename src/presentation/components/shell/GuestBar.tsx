import { useTranslations } from "next-intl";
import { ButtonLink } from "@/presentation/components/ui/Button";
import { LanguageSwitcher } from "@/presentation/components/LanguageSwitcher";

/** 路人（沒登入）看考卷時的上方列：品牌、語言、登入 */
export function GuestBar({
  setLocale,
}: {
  setLocale: (locale: string) => Promise<void>;
}) {
  const t = useTranslations();
  return (
    <header className="border-b border-border bg-background/90">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <a href="/" className="font-semibold text-heading">
          {t("common.brand")}
        </a>
        <div className="flex items-center gap-4">
          <LanguageSwitcher setLocale={setLocale} />
          <ButtonLink href="/login" size="sm">
            {t("nav.loginOrSignup")}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
