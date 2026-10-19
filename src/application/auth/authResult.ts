export type RequestLoginLinkResult = { ok: true } | { ok: false; error: string };

export type VerifyLoginLinkResult =
  { ok: true; accountId: string } | { ok: false; error: string };
