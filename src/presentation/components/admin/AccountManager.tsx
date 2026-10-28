"use client";

import { useActionState } from "react";
import type { Account } from "@/domain/account/account";
import { ROLES } from "@/domain/account/role";
import type { ManageFormState } from "@/presentation/components/formStates";
import { useTranslations } from "next-intl";
import { Button } from "@/presentation/components/ui/Button";
import { manageErrorText } from "@/presentation/lib/errorMessages";

type Action = (prev: ManageFormState, formData: FormData) => Promise<ManageFormState>;

function Messages({ state }: { state: ManageFormState }) {
  const t = useTranslations();
  if (state.problems?.length) {
    return (
      <span className="text-sm text-destructive">
        {state.problems
          .map((p) => manageErrorText(t, p))
          .join(t("common.problemSeparator"))}
      </span>
    );
  }
  return state.saved ? (
    <span className="text-sm text-muted-foreground">{t("common.saved")}</span>
  ) : null;
}

function RoleCheckboxes({ checked }: { checked: readonly string[] }) {
  const t = useTranslations("roles");
  return (
    <span className="flex flex-wrap gap-4">
      {ROLES.map((r) => (
        <label key={r} className="flex items-center gap-1">
          <input
            type="checkbox"
            name="roles"
            value={r}
            defaultChecked={checked.includes(r)}
          />
          {t(r)}
        </label>
      ))}
    </span>
  );
}

function AccountRow({
  account,
  action,
  isSelf,
}: {
  account: Account;
  action: Action;
  isSelf: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const t = useTranslations();
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <form action={formAction} className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <input type="hidden" name="accountId" value={account.id} />
        <span className="min-w-56 font-medium">
          {account.email}
          {isSelf && (
            <span className="ml-2 text-xs text-muted-foreground">
              {t("accounts.you")}
            </span>
          )}
        </span>
        <RoleCheckboxes checked={account.roles} />
        <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
          {isPending ? t("common.saving") : t("common.save")}
        </Button>
        <Messages state={state} />
      </form>
    </li>
  );
}

type Props = {
  accounts: Account[];
  selfId: string;
  setRoles: Action;
  addAccount: Action;
};

/** 管理權限：指定每個帳號的角色、新增帳號。角色能做哪些功能是固定的，寫在程式裡。 */
export function AccountManager({ accounts, selfId, setRoles, addAccount }: Props) {
  const [addState, addFormAction, adding] = useActionState(addAccount, {});
  const t = useTranslations();
  return (
    <div className="grid gap-8">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold">{t("accounts.addHeading")}</h2>
        <form
          action={addFormAction}
          className="flex flex-wrap items-center gap-x-6 gap-y-2"
        >
          <input
            name="email"
            type="email"
            required
            placeholder={t("accounts.emailPlaceholder")}
            className="min-w-56 rounded-lg border border-border px-3 py-1.5"
          />
          <RoleCheckboxes checked={[]} />
          <Button type="submit" size="sm" disabled={adding}>
            {t("accounts.add")}
          </Button>
          <Messages state={addState} />
        </form>
      </section>
      <ul className="grid gap-3">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} action={setRoles} isSelf={a.id === selfId} />
        ))}
      </ul>
    </div>
  );
}
