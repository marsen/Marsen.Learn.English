import { describe, it, expect, beforeEach } from "vitest";
import { AddAccount, ListAccounts, SetAccountRoles } from "./manageAccounts";
import type { Account } from "@/domain/account/account";
import { InMemoryAccountRepository } from "@/infrastructure/persistence/inMemoryAccountRepository";

let repo: InMemoryAccountRepository;
let admin: Account;
let teacher: Account;

beforeEach(async () => {
  repo = new InMemoryAccountRepository();
  admin = await repo.create("admin@marsen.me");
  await repo.setRoles(admin.id, ["admin", "teacher"]);
  admin = (await repo.findById(admin.id))!;
  teacher = await repo.create("t@marsen.me");
  await repo.setRoles(teacher.id, ["teacher"]);
  teacher = (await repo.findById(teacher.id))!;
});

describe("ListAccounts", () => {
  it("應該只讓管理員看帳號清單", async () => {
    expect(
      (await new ListAccounts(repo).execute({ actor: admin }))?.map((a) => a.email),
    ).toEqual(["admin@marsen.me", "t@marsen.me"]);
    expect(await new ListAccounts(repo).execute({ actor: teacher })).toBeNull();
  });
});

describe("AddAccount", () => {
  it("應該讓管理員新增帳號並指定角色", async () => {
    const r = await new AddAccount(repo).execute({
      actor: admin,
      email: " New@Teacher.com ",
      roles: ["teacher"],
    });
    expect(r).toEqual({ ok: true });
    expect((await repo.findByEmail("new@teacher.com"))?.roles).toEqual(["teacher"]);
  });

  it("應該擋下重複的 email、錯的格式、沒有權限的人", async () => {
    expect(
      (
        await new AddAccount(repo).execute({
          actor: admin,
          email: "t@marsen.me",
          roles: [],
        })
      ).ok,
    ).toBe(false);
    expect(
      (await new AddAccount(repo).execute({ actor: admin, email: "nope", roles: [] })).ok,
    ).toBe(false);
    expect(
      (await new AddAccount(repo).execute({ actor: teacher, email: "x@y.co", roles: [] }))
        .ok,
    ).toBe(false);
  });
});

describe("SetAccountRoles", () => {
  it("應該讓管理員改別人的角色", async () => {
    const r = await new SetAccountRoles(repo).execute({
      actor: admin,
      accountId: teacher.id,
      roles: ["teacher", "student"],
    });
    expect(r).toEqual({ ok: true });
    expect((await repo.findById(teacher.id))?.roles).toEqual(["teacher", "student"]);
  });

  it("應該不讓管理員拿掉自己的管理員角色", async () => {
    const r = await new SetAccountRoles(repo).execute({
      actor: admin,
      accountId: admin.id,
      roles: ["teacher"],
    });
    expect(r.ok).toBe(false);
    expect((await repo.findById(admin.id))?.roles).toContain("admin");
  });

  it("應該不讓沒有管理權限的人改角色", async () => {
    const r = await new SetAccountRoles(repo).execute({
      actor: teacher,
      accountId: teacher.id,
      roles: ["admin"],
    });
    expect(r.ok).toBe(false);
    expect((await repo.findById(teacher.id))?.roles).toEqual(["teacher"]);
  });
});
