import { describe, it, expect } from "vitest";
import { can, permissionsOf, GUEST_PERMISSIONS } from "./permission";

describe("permissionsOf", () => {
  it("應該讓沒有角色的帳號等同路人", () => {
    expect([...permissionsOf([])].sort()).toEqual([...GUEST_PERMISSIONS].sort());
  });

  it("應該把多個角色的功能加起來", () => {
    expect([...permissionsOf(["admin", "teacher"])].sort()).toEqual([
      "keepRecords",
      "manageRoles",
      "reviewSets",
      "takeExam",
      "uploadSets",
      "viewResult",
    ]);
  });
});

describe("can", () => {
  it("應該只讓管理員上傳題目、管理權限", () => {
    expect(can(["admin"], "uploadSets")).toBe(true);
    expect(can(["admin"], "manageRoles")).toBe(true);
    expect(can(["teacher"], "uploadSets")).toBe(false);
    expect(can(["student"], "manageRoles")).toBe(false);
  });

  it("應該只讓老師審稿", () => {
    expect(can(["teacher"], "reviewSets")).toBe(true);
    expect(can(["admin"], "reviewSets")).toBe(false);
    expect(can(["student"], "reviewSets")).toBe(false);
  });

  it("應該不讓只有管理員角色的帳號寫考卷", () => {
    expect(can(["admin"], "takeExam")).toBe(false);
  });

  it("應該讓管理員兼老師的帳號寫考卷", () => {
    expect(can(["admin", "teacher"], "takeExam")).toBe(true);
  });

  it("應該讓路人寫考卷、看結果，但不留考試紀錄", () => {
    expect(can([], "takeExam")).toBe(true);
    expect(can([], "viewResult")).toBe(true);
    expect(can([], "keepRecords")).toBe(false);
  });

  it("應該讓學生與老師留考試紀錄", () => {
    expect(can(["student"], "keepRecords")).toBe(true);
    expect(can(["teacher"], "keepRecords")).toBe(true);
  });
});
