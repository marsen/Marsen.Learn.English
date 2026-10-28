"use server";

import { revalidatePath } from "next/cache";
import type { ManageFormState } from "@/presentation/components/formStates";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { addAccount, setAccountRoles } from "@/infrastructure/di/authContainer";

const roles = (formData: FormData) => formData.getAll("roles").map(String);

export async function setAccountRolesAction(
  _prev: ManageFormState,
  formData: FormData,
): Promise<ManageFormState> {
  const actor = await getCurrentAccount();
  if (!actor) return { problems: [{ code: "notLoggedIn" }] };
  const r = await setAccountRoles().execute({
    actor,
    accountId: String(formData.get("accountId") ?? ""),
    roles: roles(formData),
  });
  if (!r.ok) return { problems: r.problems };
  revalidatePath("/admin/accounts");
  return { saved: true };
}

export async function addAccountAction(
  _prev: ManageFormState,
  formData: FormData,
): Promise<ManageFormState> {
  const actor = await getCurrentAccount();
  if (!actor) return { problems: [{ code: "notLoggedIn" }] };
  const r = await addAccount().execute({
    actor,
    email: String(formData.get("email") ?? ""),
    roles: roles(formData),
  });
  if (!r.ok) return { problems: r.problems };
  revalidatePath("/admin/accounts");
  return { saved: true };
}
