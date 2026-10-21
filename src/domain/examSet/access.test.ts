import { describe, it, expect } from "vitest";
import { canTake } from "./access";

const approved = { status: "approved" as const };

describe("canTake", () => {
  it("應該讓路人寫公開的合格考卷，但不能寫會員考卷", () => {
    expect(canTake([], { ...approved, access: "public" })).toBe(true);
    expect(canTake([], { ...approved, access: "members" })).toBe(false);
  });

  it("應該讓學生、老師寫所有合格考卷", () => {
    for (const roles of [["student"], ["teacher"]] as const) {
      expect(canTake(roles, { ...approved, access: "public" })).toBe(true);
      expect(canTake(roles, { ...approved, access: "members" })).toBe(true);
    }
  });

  it("應該不讓只有管理員角色的帳號寫考卷", () => {
    expect(canTake(["admin"], { ...approved, access: "public" })).toBe(false);
  });

  it("應該讓管理員兼老師的帳號寫考卷", () => {
    expect(canTake(["admin", "teacher"], { ...approved, access: "members" })).toBe(true);
  });

  it("應該不讓任何人寫下架的考卷", () => {
    for (const roles of [[], ["student"], ["teacher"], ["admin", "teacher"]] as const) {
      expect(canTake(roles, { ...approved, access: "unlisted" })).toBe(false);
    }
  });

  it("應該不讓任何人寫待審稿或不合格的考卷", () => {
    for (const status of ["pending_review", "rejected"] as const) {
      expect(canTake(["student"], { status, access: "public" })).toBe(false);
      expect(canTake([], { status, access: "public" })).toBe(false);
    }
  });
});
