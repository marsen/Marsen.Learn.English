"use client";

import type { Account } from "@/domain/account/account";
import { PERMISSIONS, permissionsOf } from "@/domain/account/permission";
import { useTranslations } from "next-intl";

/** 後台首頁：目前帳號、角色、能用的功能。 */
export function AccountSummary({ account }: { account: Account }) {
  const allowed = permissionsOf(account.roles);
  const t = useTranslations("roles");
  const tSummary = useTranslations("accountSummary");
  const tPermission = useTranslations("permissions");

  return (
    <div className="grid gap-6">
      <section>
        <h2 className="text-sm text-muted-foreground">{tSummary("email")}</h2>
        <p className="text-lg font-medium">{account.email}</p>
      </section>
      <section>
        <h2 className="text-sm text-muted-foreground">{tSummary("roles")}</h2>
        <p>
          {account.roles.length > 0
            ? account.roles.map((r) => t(r)).join(t("separator"))
            : t("none")}
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-sm text-muted-foreground">{tSummary("permissions")}</h2>
        <ul className="grid gap-1">
          {PERMISSIONS.map((p) => (
            <li
              key={p}
              className={allowed.has(p) ? "" : "text-muted-foreground line-through"}
            >
              {allowed.has(p) ? "✓" : "✗"} {tPermission(p)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
