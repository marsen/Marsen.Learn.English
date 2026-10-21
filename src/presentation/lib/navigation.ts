import { can, type Permission } from "@/domain/account/permission";
import type { Role } from "@/domain/account/role";

/**
 * 側邊欄的頁面清單：每一項標明需要什麼權限，沒有權限的人看不到那一項。
 * 新增頁面時加在這裡，順序就是側邊欄由上到下的順序。
 */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  group: "learn" | "manage";
};

export type NavIcon = "home" | "exam" | "history" | "sets" | "upload" | "accounts";

const ITEMS: (NavItem & { needs: Permission[] | "any" })[] = [
  { href: "/admin", label: "總覽", icon: "home", group: "learn", needs: "any" },
  { href: "/exam", label: "考卷", icon: "exam", group: "learn", needs: ["takeExam"] },
  {
    href: "/exam/history",
    label: "我的考試紀錄",
    icon: "history",
    group: "learn",
    needs: ["keepRecords"],
  },
  {
    href: "/admin/sets",
    label: "題組與審稿",
    icon: "sets",
    group: "manage",
    needs: ["uploadSets", "reviewSets"],
  },
  {
    href: "/admin/sets/upload",
    label: "上傳題組",
    icon: "upload",
    group: "manage",
    needs: ["uploadSets"],
  },
  {
    href: "/admin/accounts",
    label: "管理權限",
    icon: "accounts",
    group: "manage",
    needs: ["manageRoles"],
  },
];

/** 這個帳號在側邊欄看得到的項目（needs 是陣列時，有其中一個權限就看得到） */
export function navItemsFor(roles: readonly Role[]): NavItem[] {
  return ITEMS.filter((i) => i.needs === "any" || i.needs.some((p) => can(roles, p))).map(
    (i) => ({ href: i.href, label: i.label, icon: i.icon, group: i.group }),
  );
}

/** 目前網址對應哪一項：取最長的相符路徑（/admin/sets/upload 不會同時亮 /admin/sets） */
export function activeHref(items: readonly NavItem[], pathname: string): string | null {
  const hits = items.filter(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  return hits.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}
