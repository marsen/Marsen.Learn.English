export type RequestLoginLinkResult = { ok: true } | { ok: false; error: string };

export type VerifyLoginLinkResult =
  | { ok: true; accountId: string; isNew: boolean; guestId: string | null }
  | { ok: false; error: string };
