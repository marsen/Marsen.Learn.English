import type { Role } from "./role";

/** 帳號（純資料）。以 email 識別，登入不用密碼。 */
export type Account = {
  id: string;
  email: string;
  roles: Role[];
  createdAt: Date;
};
