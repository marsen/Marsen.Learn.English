"use client";

import { useTranslations } from "next-intl";
import type { Narrator, SectionVoices } from "@/application/examSet/narratorVoices";

const GENDERS = ["m", "f"] as const;
const AGES = ["young", "middle", "old"] as const;

/** 審稿頁標題下面的「錄音旁白」（只有管理員看得到）：每段旁白 A、B 各用什麼聲音 */
export function NarratorVoices({
  voices,
  fullExam,
}: {
  voices: SectionVoices[];
  fullExam: boolean;
}) {
  const t = useTranslations("review.voices");
  const missing = t("notRecorded");
  const or = (v: string | null) => v ?? missing;
  const known = <T extends string>(list: readonly T[], v: string | null): v is T =>
    v !== null && (list as readonly string[]).includes(v);
  const gender = (v: string | null) => (known(GENDERS, v) ? t(`gender.${v}`) : or(v));
  const age = (v: string | null) => (known(AGES, v) ? t(`age.${v}`) : or(v));
  const sections = voices;
  // 完整考卷在網站開始存旁白之前上傳的，資料庫裡沒有：提示重新上傳
  const someMissing =
    fullExam && (sections.length === 0 || sections.some((s) => s.narrators.length === 0));

  // [欄位名稱, 顯示的字, 是不是沒記錄]
  const fields = (n: Narrator): [string, string, boolean][] => [
    [t("engine"), or(n.engine), n.engine === null],
    [t("voice"), or(n.voice), n.voice === null],
    [t("accent"), or(n.accent), n.accent === null],
    [t("genderLabel"), gender(n.gender), n.gender === null],
    [t("ageLabel"), age(n.age), n.age === null],
  ];

  return (
    <details data-narrator-voices className="mt-2">
      <summary className="cursor-pointer text-sm font-semibold">{t("title")}</summary>
      <div className="mt-2 grid gap-3 rounded-lg border border-border bg-card px-3 py-2">
        {sections.length === 0 && <p>{missing}</p>}
        {sections.map((s) => (
          <div key={s.ieltsSection ?? "set"}>
            {s.ieltsSection !== null && (
              <p className="font-semibold text-foreground">
                {t("section", { n: s.ieltsSection })}
              </p>
            )}
            {s.narrators.length === 0 ? (
              <p>{missing}</p>
            ) : (
              <ul className="grid gap-1">
                {s.narrators.map((n) => (
                  <li key={n.role} className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <b className="text-foreground">{t("narrator", { role: n.role })}</b>
                    {fields(n).map(([label, value, none]) => (
                      <span key={label} className="break-all">
                        {label}
                        {t("colon")}
                        <span className={none ? "" : "text-foreground"}>{value}</span>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {someMissing && <p className="text-xs">{t("reuploadHint")}</p>}
      </div>
    </details>
  );
}
