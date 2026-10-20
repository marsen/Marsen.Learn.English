import { describe, it, expect } from "vitest";
import { cleanRoles, roleProblems } from "./roleRules";

describe("roleProblems", () => {
  it("應該允許管理員改別人的角色，包括拿掉全部角色", () => {
    expect(roleProblems({ actorId: "a", targetId: "b", roles: [] })).toEqual([]);
    expect(
      roleProblems({ actorId: "a", targetId: "b", roles: ["teacher", "admin"] }),
    ).toEqual([]);
  });

  it("應該不讓管理員拿掉自己的管理員角色", () => {
    expect(
      roleProblems({ actorId: "a", targetId: "a", roles: ["teacher"] }),
    ).toHaveLength(1);
    expect(roleProblems({ actorId: "a", targetId: "a", roles: ["admin"] })).toEqual([]);
  });

  it("應該擋下不認得的角色", () => {
    expect(roleProblems({ actorId: "a", targetId: "b", roles: ["boss"] })).toHaveLength(
      1,
    );
  });
});

describe("cleanRoles", () => {
  it("應該去掉重複與不認得的角色", () => {
    expect(cleanRoles(["teacher", "teacher", "boss", "student"])).toEqual([
      "teacher",
      "student",
    ]);
  });
});
