import type { Account } from "@/domain/account/account";
import { PERMISSIONS, permissionsOf } from "@/domain/account/permission";
import { useTranslations } from "next-intl";
import { PERMISSION_LABELS } from "@/presentation/lib/labels";

/** 後台首頁：目前帳號、角色、能用的功能。 */
export function AccountSummary({ account }: { account: Account }) {
  const allowed = permissionsOf(account.roles);
  const t = useTranslations("roles");

  return (
    <div className="grid gap-6">
      <section>
        <h2 className="text-sm text-muted-foreground">登入帳號</h2>
        <p className="text-lg font-medium">{account.email}</p>
      </section>
      <section>
        <h2 className="text-sm text-muted-foreground">角色</h2>
        <p>
          {account.roles.length > 0
            ? account.roles.map((r) => t(r)).join(t("separator"))
            : t("none")}
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-sm text-muted-foreground">能用的功能</h2>
        <ul className="grid gap-1">
          {PERMISSIONS.map((p) => (
            <li
              key={p}
              className={allowed.has(p) ? "" : "text-muted-foreground line-through"}
            >
              {allowed.has(p) ? "✓" : "✗"} {PERMISSION_LABELS[p]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
