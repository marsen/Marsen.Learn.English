import { describe, it, expect } from "vitest";
import { activeHref, navItemsFor } from "./navigation";

const hrefs = (roles: Parameters<typeof navItemsFor>[0]) =>
  navItemsFor(roles).map((i) => i.href);

describe("navItemsFor", () => {
  it("應該讓學生只看到總覽、考卷、考試紀錄", () => {
    expect(hrefs(["student"])).toEqual(["/admin", "/exam", "/exam/history"]);
  });

  it("應該讓老師多看到題組與審稿，但沒有上傳和管理權限", () => {
    expect(hrefs(["teacher"])).toEqual([
      "/admin",
      "/exam",
      "/exam/history",
      "/admin/sets",
    ]);
  });

  it("應該讓只有管理員角色的帳號看到管理功能，沒有考卷", () => {
    expect(hrefs(["admin"])).toEqual([
      "/admin",
      "/admin/sets",
      "/admin/sets/upload",
      "/admin/accounts",
    ]);
  });

  it("應該讓管理員兼老師看到全部", () => {
    expect(hrefs(["admin", "teacher"])).toHaveLength(6);
  });
});

describe("activeHref", () => {
  const items = navItemsFor(["admin", "teacher"]);

  it("應該選最長的相符路徑", () => {
    expect(activeHref(items, "/admin/sets/upload")).toBe("/admin/sets/upload");
    expect(activeHref(items, "/admin/sets/s1-gym-0001")).toBe("/admin/sets");
    expect(activeHref(items, "/exam/s1-gym-0001")).toBe("/exam");
    expect(activeHref(items, "/exam/history")).toBe("/exam/history");
    expect(activeHref(items, "/admin")).toBe("/admin");
  });

  it("應該在沒有相符時回 null", () => {
    expect(activeHref(items, "/login")).toBeNull();
  });
});
