import { describe, it, expect } from "vitest";
import {
  alertThresholdReached,
  sendBlockReason,
  DAILY_SIGNUP_CUTOFF,
  EMAIL_MAX_PER_HOUR,
  IP_MAX_PER_HOUR,
  type SendFacts,
} from "./sendLimits";

const now = new Date("2026-10-20T12:00:00Z");
const ok: SendFacts = {
  now,
  lastSentToEmail: null,
  emailSentLastHour: 0,
  ipSentLastHour: 0,
  sentLastDay: 0,
  hasAccount: false,
};
const ago = (s: number) => new Date(now.getTime() - s * 1000);

describe("sendBlockReason", () => {
  it("應該允許第一次申請", () => {
    expect(sendBlockReason(ok)).toBeNull();
  });

  it("應該要同一個 email 兩封至少隔 60 秒", () => {
    expect(sendBlockReason({ ...ok, lastSentToEmail: ago(30) })).toContain("30 秒");
    expect(sendBlockReason({ ...ok, lastSentToEmail: ago(60) })).toBeNull();
  });

  it("應該擋下同一個 email 每小時超過 5 封", () => {
    expect(
      sendBlockReason({ ...ok, emailSentLastHour: EMAIL_MAX_PER_HOUR - 1 }),
    ).toBeNull();
    expect(sendBlockReason({ ...ok, emailSentLastHour: EMAIL_MAX_PER_HOUR })).toContain(
      "太多次",
    );
  });

  it("應該擋下同一個 IP 每小時超過 20 封；不知道 IP 時不檢查", () => {
    expect(sendBlockReason({ ...ok, ipSentLastHour: IP_MAX_PER_HOUR - 1 })).toBeNull();
    expect(sendBlockReason({ ...ok, ipSentLastHour: IP_MAX_PER_HOUR })).toContain("網路");
    expect(sendBlockReason({ ...ok, ipSentLastHour: null })).toBeNull();
  });

  it("應該在全站 24 小時達 95 封時只擋新 email，已有帳號照常寄", () => {
    expect(sendBlockReason({ ...ok, sentLastDay: DAILY_SIGNUP_CUTOFF - 1 })).toBeNull();
    expect(sendBlockReason({ ...ok, sentLastDay: DAILY_SIGNUP_CUTOFF })).toContain(
      "今天註冊人數已滿",
    );
    expect(
      sendBlockReason({ ...ok, sentLastDay: DAILY_SIGNUP_CUTOFF, hasAccount: true }),
    ).toBeNull();
  });
});

describe("alertThresholdReached", () => {
  it("應該只在剛好 50、80 封時通知", () => {
    expect(alertThresholdReached(49)).toBeNull();
    expect(alertThresholdReached(50)).toBe(50);
    expect(alertThresholdReached(51)).toBeNull();
    expect(alertThresholdReached(80)).toBe(80);
    expect(alertThresholdReached(81)).toBeNull();
  });
});
