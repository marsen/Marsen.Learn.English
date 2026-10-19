import type { Permission } from "@/domain/account/permission";
import type { Role } from "@/domain/account/role";

/** 畫面上顯示的中文名稱 */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "管理員",
  teacher: "老師",
  student: "學生",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  uploadSets: "上傳題目",
  reviewSets: "審稿（評估試卷是否合格）",
  takeExam: "寫考卷",
  viewResult: "看批改結果",
  keepRecords: "考試紀錄",
  manageRoles: "管理權限",
};
