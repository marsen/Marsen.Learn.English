"use client";

import Form from "next/form";
import { useTranslations } from "next-intl";
import { EXAM_SET_STATUSES, type AiVerdict } from "@/domain/examSet/examSet";
import { isFilterEmpty, type ExamSetFilter } from "@/domain/examSet/examSetFilter";
import { ACCESS_ORDER } from "@/presentation/lib/examSetLabels";
import { Button, ButtonLink } from "@/presentation/components/ui/Button";

const PATH = "/admin/sets";
const AI_ORDER: readonly AiVerdict[] = ["pass", "needs_human"];

/** 網址參數名稱（跟 application 的 ExamSetFilterQuery 對應） */
type Params = { status?: string; ai?: string; access?: string; q?: string };

function paramsOf(f: ExamSetFilter): Params {
  return { status: f.status, ai: f.aiVerdict, access: f.access, q: f.keyword };
}

function hrefOf(p: Params): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${PATH}?${qs}` : PATH;
}

type Props = { filter: ExamSetFilter; count: number };

/** 題組清單的過濾器：條件都放在網址上，重新整理、上一頁、傳連結都還在 */
export function ExamSetFilterBar({ filter, count }: Props) {
  const t = useTranslations("sets.filter");
  const tAccess = useTranslations("examSet.access");
  const current = paramsOf(filter);

  const groups: {
    key: "status" | "ai" | "access";
    label: string;
    options: [string, string][];
  }[] = [
    {
      key: "status",
      label: t("teacher"),
      options: EXAM_SET_STATUSES.map((s) => [s, t(`status.${s}`)]),
    },
    { key: "ai", label: t("ai"), options: AI_ORDER.map((a) => [a, t(`verdict.${a}`)]) },
    {
      key: "access",
      label: t("access"),
      options: ACCESS_ORDER.map((a) => [a, tAccess(a)]),
    },
  ];

  return (
    <div className="mb-4 space-y-2">
      {groups.map((g) => (
        <div key={g.key} className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 shrink-0 text-sm text-muted-foreground">{g.label}</span>
          {[[undefined, t("all")] as const, ...g.options].map(([value, label]) => {
            const active = current[g.key] === value;
            return (
              <ButtonLink
                key={value ?? "all"}
                href={hrefOf({ ...current, [g.key]: value })}
                variant={active ? "primary" : "secondary"}
                size="xs"
                aria-current={active ? "true" : undefined}
              >
                {label}
              </ButtonLink>
            );
          })}
        </div>
      ))}
      <Form action={PATH} className="flex flex-wrap items-center gap-1.5 pt-1">
        {(["status", "ai", "access"] as const).map(
          (k) =>
            current[k] && <input key={k} type="hidden" name={k} value={current[k]} />,
        )}
        <input
          key={filter.keyword ?? ""}
          type="search"
          name="q"
          defaultValue={filter.keyword}
          placeholder={t("keywordPlaceholder")}
          aria-label={t("keywordPlaceholder")}
          className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
        />
        <Button type="submit" variant="secondary" size="xs">
          {t("search")}
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          {t("count", { count })}
        </span>
        {!isFilterEmpty(filter) && (
          <ButtonLink href={PATH} variant="secondary" size="xs">
            {t("clear")}
          </ButtonLink>
        )}
      </Form>
    </div>
  );
}
