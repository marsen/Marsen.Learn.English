import type { Permission } from "@/domain/account/permission";

/** 功能名稱（只在管理員看的帳號摘要用；角色名稱在翻譯檔 roles.*） */
export const PERMISSION_LABELS: Record<Permission, string> = {
  uploadSets: "上傳題目",
  reviewSets: "審稿（評估試卷是否合格）",
  setExamAccess: "設定考卷開放對象",
  takeExam: "寫考卷",
  viewResult: "看批改結果",
  viewAnswerKey: "看正解",
  keepRecords: "考試紀錄",
  manageRoles: "管理權限",
  viewReviewLog: "看審稿紀錄",
};
