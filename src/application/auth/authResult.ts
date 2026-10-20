export type RequestLoginLinkResult = { ok: true } | { ok: false; error: string };

export type VerifyLoginLinkResult =
  { ok: true; accountId: string; isNew: boolean } | { ok: false; error: string };
