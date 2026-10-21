import { describe, it, expect } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("應該接受 uuid，擋掉其他字串", () => {
    expect(isUuid("3f2b8c1e-9a4d-4c2b-8e1f-0a1b2c3d4e5f")).toBe(true);
    expect(isUuid("dev-admin")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("3f2b8c1e-9a4d-4c2b-8e1f-0a1b2c3d4e5f; drop table")).toBe(false);
  });
});
