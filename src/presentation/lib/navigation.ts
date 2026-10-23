import { can, type Permission } from "@/domain/account/permission";
import type { Role } from "@/domain/account/role";

/**
 * 側邊欄的頁面清單：每一項標明需要什麼權限，沒有權限的人看不到那一項。
 * 新增頁面時加在這裡，順序就是側邊欄由上到下的順序。
 */
export type NavItem = {
  href: string;
  /** 顯示的名稱在翻譯檔 nav.items.<icon> */
  icon: NavIcon;
  group: "learn" | "manage";
};

export type NavIcon =
  "home" | "exam" | "history" | "sets" | "upload" | "reviews" | "accounts";

const ITEMS: (NavItem & { needs: Permission[] | "any" })[] = [
  { href: "/admin", icon: "home", group: "learn", needs: "any" },
  { href: "/exam", icon: "exam", group: "learn", needs: ["takeExam"] },
  {
    href: "/exam/history",
    icon: "history",
    group: "learn",
    needs: ["keepRecords"],
  },
  {
    href: "/admin/sets",
    icon: "sets",
    group: "manage",
    needs: ["uploadSets", "reviewSets"],
  },
  {
    href: "/admin/sets/upload",
    icon: "upload",
    group: "manage",
    needs: ["uploadSets"],
  },
  {
    href: "/admin/reviews",
    icon: "reviews",
    group: "manage",
    needs: ["viewReviewLog"],
  },
  {
    href: "/admin/accounts",
    icon: "accounts",
    group: "manage",
    needs: ["manageRoles"],
  },
];

/** 這個帳號在側邊欄看得到的項目（needs 是陣列時，有其中一個權限就看得到） */
export function navItemsFor(roles: readonly Role[]): NavItem[] {
  return ITEMS.filter((i) => i.needs === "any" || i.needs.some((p) => can(roles, p))).map(
    (i) => ({ href: i.href, icon: i.icon, group: i.group }),
  );
}

/** 目前網址對應哪一項：取最長的相符路徑（/admin/sets/upload 不會同時亮 /admin/sets） */
export function activeHref(items: readonly NavItem[], pathname: string): string | null {
  const hits = items.filter(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  return hits.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}
