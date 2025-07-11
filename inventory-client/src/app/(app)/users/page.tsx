"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, UserCheck, Shield } from "lucide-react";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from "@/hooks";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { UsersDataTable } from "@/components/users/users-data-table";
import { createUsersColumns } from "@/components/users/users-columns";
import { UserItem } from "@/types/api-helpers";
import { UserActions } from "@/components/users/users-columns";
import { UserStoresDialog } from "@/components/users/user-stores-dialog";
import { RoleSelector } from "@/components/users/role-selector";
import { useQueryClient } from "@tanstack/react-query";

/**
 * 用戶管理頁面（伺服器端認證版本）
 *
 * 安全特性：
 * - 雙重認證檢查：用戶登入 + 管理員權限
 * - 伺服器端身份驗證，未認證用戶無法取得頁面內容
 * - 使用 Next.js redirect() 進行伺服器端重定向
 * - 完全杜絕「偷看」問題，提供企業級安全性
 *
 * 架構設計：
 * - 伺服器元件處理認證和權限檢查
 * - 客戶端元件處理複雜的互動邏輯
 * - 保持 SEO 友好的伺服器端渲染
 */
export default function UsersPage() {
  const { data: session } = useSession();
  const user = session?.user; // 獲取當前用戶資訊以判斷權限

  // 搜索狀態管理
  const [searchQuery, setSearchQuery] = useState("");

  // 使用搜索功能的 useUsers hook（類型安全版本）
  const {
    data: usersResponse,
    isLoading,
    error,
  } = useUsers(searchQuery ? { "filter[search]": searchQuery } : undefined);

  const usersData = usersResponse?.data || [];
  const meta = usersResponse?.meta;

  const createUserMutation = useCreateUser();
  const deleteUserMutation = useDeleteUser();

  // 對話框狀態管理
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // 新用戶表單狀態
  const [newUserName, setNewUserName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoles, setNewRoles] = useState<string[]>([]); // 多角色支持

  // 編輯用戶狀態
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]); // 多角色支持

  // 刪除確認對話框狀態
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);

  // 使用 useUpdateUser hook（重構版，不需要預先提供 userId）
  const updateUserMutation = useUpdateUser();

  // 用戶分店管理狀態
  const [isStoresDialogOpen, setIsStoresDialogOpen] = useState(false);
  const [selectedUserForStores, setSelectedUserForStores] =
    useState<UserItem | null>(null);

  const queryClient = useQueryClient();

  // 處理分店管理按鈕點擊
  const handleManageUserStores = (user: UserItem) => {
    setSelectedUserForStores(user);
    setIsStoresDialogOpen(true);
  };

  // helper: clear selected user when dialog closes
  const handleStoresDialogOpenChange = (open: boolean) => {
    setIsStoresDialogOpen(open);
    if (!open) {
      setSelectedUserForStores(null);
    }
  };

  /**
   * 處理創建新用戶的函式
   *
   * 功能說明：
   * 1. 驗證表單輸入
   * 2. 調用 useCreateUser mutation
   * 3. 處理成功和錯誤回饋
   * 4. 重置表單狀態
   */
  const handleCreateUser = () => {
    // 基本驗證
    if (!newUserName.trim() || !newUsername.trim() || !newPassword.trim() || !newUserEmail.trim()) {
      toast.error("請填寫所有必填欄位");
      return;
    }

    // 密碼長度驗證
    if (newPassword.length < 8) {
      toast.error("密碼至少需要 8 個字元");
      return;
    }

    // 角色驗證
    if (newRoles.length === 0) {
      toast.error("請至少選擇一個角色");
      return;
    }

    createUserMutation.mutate(
      {
        name: newUserName,
        username: newUsername,
        password: newPassword,
        password_confirmation: newPassword,  // ✅ 新增確認密碼字段
        roles: newRoles as ("admin" | "staff" | "viewer" | "installer")[],
        role: newRoles[0] || "viewer", // API 要求的單一 role 字段
      },
      {
        onSuccess: () => {
          toast.success("用戶建立成功！");
          setIsDialogOpen(false); // 關閉對話框
          // 重置表單狀態
          resetForm();
        },
        onError: (error) => {
          // 改進錯誤顯示：提供更詳細的錯誤信息
          const errorMessage = error.message;

          if (
            errorMessage.includes("用戶名已被使用") ||
            errorMessage.includes("username")
          ) {
            toast.error(
              `用戶名重複：${newUsername} 已被使用，請選擇其他用戶名`,
            );
          } else if (errorMessage.includes("密碼")) {
            toast.error(`密碼錯誤：${errorMessage}`);
          } else if (errorMessage.includes("角色")) {
            toast.error(`角色錯誤：${errorMessage}`);
          } else {
            toast.error(`建立失敗：${errorMessage}`);
          }
        },
      },
    );
  };

  /**
   * 處理新增用戶按鈕點擊
   */
  const handleAddUser = () => {
    setIsDialogOpen(true);
  };

  /**
   * 處理編輯用戶
   */
  const handleEditUser = (userToEdit: UserItem) => {
    setEditingUser(userToEdit);
    setEditUserName(userToEdit.name || "");
    setEditUsername(userToEdit.username || "");
    setEditUserEmail(userToEdit.email || "");
    setEditPassword(""); // 密碼留空，表示不更改
    setEditRoles((userToEdit.roles || []) as ("admin" | "staff" | "viewer" | "installer")[]);
    setIsEditDialogOpen(true);
  };

  /**
   * 處理更新用戶的函式
   */
  const handleUpdateUser = () => {
    if (!editingUser?.id) {
      toast.error("無效的用戶 ID");
      return;
    }

    // 基本驗證
    if (!editUserName.trim() || !editUsername.trim()) {
      toast.error("請填寫所有必填欄位");
      return;
    }

    // 角色驗證
    if (editRoles.length === 0) {
      toast.error("請至少選擇一個角色");
      return;
    }

    // 構建更新資料 - 條件性包含密碼欄位
    const updatePayload: any = {
      name: editUserName,
      username: editUsername,
      email: editUserEmail,
      roles: editRoles as ("admin" | "staff" | "viewer" | "installer")[],
    };

    // 只有當用戶輸入新密碼時，才包含密碼欄位
    if (editPassword.trim()) {
      updatePayload.password = editPassword;
      updatePayload.password_confirmation = editPassword;  // ✅ 新增確認密碼字段
    }

    updateUserMutation.mutate(
      {
        id: editingUser.id,
        body: updatePayload,
      },
      {
        onSuccess: () => {
          toast.success("用戶更新成功！");
          setIsEditDialogOpen(false);
          resetEditForm();
        },
        onError: (error) => {
          toast.error(`更新失敗：${error.message}`);
        },
      },
    );
  };

  /**
   * 處理刪除用戶
   */
  const handleDeleteUser = (userToDelete: UserItem) => {
    if (!userToDelete.id) {
      toast.error("無效的用戶 ID");
      return;
    }

    deleteUserMutation.mutate(
      userToDelete.id,
      {
        onSuccess: () => {
          toast.success("用戶刪除成功！");
          setUserToDelete(null); // 清除狀態
        },
        onError: (error) => {
          toast.error(`刪除失敗：${error.message}`);
          setUserToDelete(null); // 清除狀態
        },
      },
    );
  };

  /**
   * 重置表單狀態
   */
  const resetForm = () => {
    setNewUserName("");
    setNewUsername("");
    setNewUserEmail("");
    setNewPassword("");
    setNewRoles([]);
  };

  /**
   * 重置編輯表單狀態
   */
  const resetEditForm = () => {
    setEditingUser(null);
    setEditUserName("");
    setEditUsername("");
    setEditUserEmail("");
    setEditPassword("");
    setEditRoles([]);
  };

  /**
   * 處理對話框關閉事件
   */
  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm(); // 關閉時重置表單
    }
  };

  /**
   * 處理編輯對話框關閉事件
   */
  const handleEditDialogClose = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      resetEditForm(); // 關閉時重置編輯表單
    }
  };

  // 用戶動作定義（符合新的 UserActions 介面）
  const userActions: UserActions = {
    onView: (user: UserItem) => {
      toast.info(`查看用戶：${user.name}`);
    },
    onEdit: handleEditUser,
    onDelete: handleDeleteUser,
    onManageStores: handleManageUserStores,
  };

  // 創建表格欄位定義
  const columns = createUsersColumns(userActions);

  // 檢查管理員權限 - 使用 useAuth hook 來檢查權限
  if (!user?.isAdmin) {
    return (
      <div className="container mx-auto py-8" data-oid="t-0ly8x">
        <Card data-oid="ndg_yph">
          <CardContent className="pt-6" data-oid="trh-dbl">
            <div className="text-center" data-oid="uk7mba8">
              <Shield
                className="mx-auto h-12 w-12 text-gray-400"
                data-oid="rivxq1u"
              />

              <h3
                className="mt-2 text-sm font-medium text-gray-900 dark:text-white"
                data-oid="mhkwen6"
              >
                權限不足
              </h3>
              <p
                className="mt-1 text-sm text-gray-500 dark:text-gray-400"
                data-oid="6:2l5il"
              >
                您沒有權限訪問用戶管理功能
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 只有已登入且為管理員的用戶才會執行到這裡
  return (
    <div className="container mx-auto py-8 space-y-6" data-oid="r7udv0r">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between" data-oid="nuq9_-i">
        <div data-oid="tu2xz8x">
          <h1
            className="text-3xl font-bold text-gray-900 dark:text-white"
            data-oid="5nzglce"
          >
            用戶管理
          </h1>
          <p
            className="text-gray-600 dark:text-gray-300 mt-2"
            data-oid="d:6f:tk"
          >
            管理系統中的所有用戶帳號
          </p>
        </div>
      </div>

      {/* 用戶資料表格 */}
      <div className="space-y-4" data-oid="ql8wyy0">
        <UsersDataTable
          columns={columns}
          data={usersData}
          isLoading={isLoading}
          showAddButton={user?.isAdmin}
          onAddUser={handleAddUser}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          data-oid="xzuzf:q"
        />
      </div>

      {/* 新增用戶對話框 */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        data-oid="k:_qcqq"
      >
        <DialogContent className="sm:max-w-[425px]" data-oid="g.u-jqd">
          <DialogHeader data-oid="wfwvpko">
            <DialogTitle className="flex items-center gap-2" data-oid="wx0:8wq">
              <UserCheck className="w-5 h-5" data-oid="nomy5gx" />
              建立新用戶
            </DialogTitle>
            <DialogDescription data-oid="0fsh8fb">
              填寫以下資訊以建立一個新的使用者帳號。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4" data-oid="2f2bxdy">
            {/* 姓名欄位 */}
            <div
              className="grid grid-cols-4 items-center gap-4"
              data-oid="-n7w.o0"
            >
              <Label
                htmlFor="name"
                className="text-right font-medium"
                data-oid="u2l_11l"
              >
                姓名{" "}
                <span className="text-red-500" data-oid="_:9v8se">
                  *
                </span>
              </Label>
              <Input
                id="name"
                placeholder="輸入用戶姓名"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="col-span-3"
                disabled={createUserMutation.isPending}
                data-oid="fbe9ci1"
              />
            </div>

            {/* 帳號欄位 */}
            <div
              className="grid grid-cols-4 items-center gap-4"
              data-oid=".:u7sq4"
            >
              <Label
                htmlFor="username"
                className="text-right font-medium"
                data-oid="54r71u3"
              >
                用戶名{" "}
                <span className="text-red-500" data-oid="i9ff4t5">
                  *
                </span>
              </Label>
              <Input
                id="username"
                placeholder="輸入用戶名"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="col-span-3"
                disabled={createUserMutation.isPending}
                data-oid="6gq16i7"
              />
            </div>

            {/* Email 欄位 */}
            <div
              className="grid grid-cols-4 items-center gap-4"
              data-oid="email-field"
            >
              <Label
                htmlFor="email"
                className="text-right font-medium"
              >
                電子郵件{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="輸入電子郵件"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="col-span-3"
                disabled={createUserMutation.isPending}
              />
            </div>

            {/* 密碼欄位 */}
            <div
              className="grid grid-cols-4 items-center gap-4"
              data-oid="vh1h3gt"
            >
              <Label
                htmlFor="password"
                className="text-right font-medium"
                data-oid="5cq.19t"
              >
                密碼{" "}
                <span className="text-red-500" data-oid="225cazk">
                  *
                </span>
              </Label>
              <div className="col-span-3 space-y-1" data-oid="5mg:sbv">
                <Input
                  id="password"
                  type="password"
                  placeholder="輸入密碼"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={createUserMutation.isPending}
                  data-oid="8nxs091"
                />

                <p className="text-xs text-gray-500" data-oid="q-8yk.p">
                  密碼至少需要 8 個字元
                </p>
              </div>
            </div>

            {/* 角色選擇 */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right font-medium mt-3">
                角色 <span className="text-red-500">*</span>
              </Label>
              <div className="col-span-3">
                <RoleSelector
                  selectedRoles={newRoles}
                  onRolesChange={(roles) => setNewRoles(roles)}
                  disabled={createUserMutation.isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter data-oid="27wcl53">
            <Button
              variant="outline"
              onClick={() => handleDialogClose(false)}
              disabled={createUserMutation.isPending}
              data-oid="iod7ast"
            >
              取消
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-oid="63uya0f"
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2
                    className="w-4 h-4 mr-2 animate-spin"
                    data-oid="d-0n9ch"
                  />
                  建立中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" data-oid="puv8pcg" />
                  建立用戶
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯用戶對話框 */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogClose}
        data-oid="u21j:jr"
      >
        <DialogContent className="sm:max-w-[425px]" data-oid=".eflfyy">
          <DialogHeader data-oid="znbwg:v">
            <DialogTitle className="flex items-center gap-2" data-oid="y3fb98d">
              <UserCheck className="w-5 h-5" data-oid="kpg2xhy" />
              編輯用戶
            </DialogTitle>
            <DialogDescription data-oid="pxxxk:d">
              修改用戶資訊。密碼欄位留空表示不更改密碼。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4" data-oid="2533gp5">
            {/* 姓名欄位 */}
            <div
              className="grid grid-cols-4 items-center gap-4"
              data-oid="6ugu9mm"
            >
              <Label
                htmlFor="edit-name"
                className="text-right font-medium"
                data-oid="43xahi0"
              >
                姓名{" "}
                <span className="text-red-500" data-oid="sb5lm19">
                  *
                </span>
              </Label>
              <Input
                id="edit-name"
                placeholder="輸入用戶姓名"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                className="col-span-3"
                disabled={updateUserMutation.isPending}
                data-oid="9j3jjz1"
              />
            </div>

            {/* 帳號欄位 */}
            <div
              className="grid grid-cols-4 items-center gap-4"
              data-oid="h61mwg8"
            >
              <Label
                htmlFor="edit-username"
                className="text-right font-medium"
                data-oid="j_62pjb"
              >
                用戶名{" "}
                <span className="text-red-500" data-oid="6m_0d3.">
                  *
                </span>
              </Label>
              <Input
                id="edit-username"
                placeholder="輸入用戶名"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="col-span-3"
                disabled={updateUserMutation.isPending}
                data-oid="z.z5hw5"
              />
            </div>

            {/* Email 編輯欄位 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                電子郵件 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                className="col-span-3"
                disabled={updateUserMutation.isPending}
              />
            </div>

            {/* 密碼欄位 */}
            <div
              className="grid grid-cols-4 items-center gap-4"
              data-oid="yx7b9iy"
            >
              <Label
                htmlFor="edit-password"
                className="text-right font-medium"
                data-oid="86r5mq0"
              >
                密碼{" "}
                <span className="text-gray-500" data-oid="cca.95y">
                  (留空不更改)
                </span>
              </Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="輸入新密碼（或留空）"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="col-span-3"
                disabled={updateUserMutation.isPending}
                data-oid="8:jddk2"
              />
            </div>

            {/* 角色選擇 */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right font-medium mt-3">
                角色 <span className="text-red-500">*</span>
              </Label>
              <div className="col-span-3">
                <RoleSelector
                  selectedRoles={editRoles}
                  onRolesChange={(roles) => setEditRoles(roles)}
                  disabled={updateUserMutation.isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter data-oid="lhrnvg3">
            <Button
              variant="outline"
              onClick={() => handleEditDialogClose(false)}
              disabled={updateUserMutation.isPending}
              data-oid="6gvpbc-"
            >
              取消
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-oid=":5q8486"
            >
              {updateUserMutation.isPending ? (
                <>
                  <Loader2
                    className="w-4 h-4 mr-2 animate-spin"
                    data-oid="qdpltlf"
                  />
                  更新中...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" data-oid="k4n3cuv" />
                  更新用戶
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <AlertDialog
        open={!!userToDelete}
        onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}
        data-oid="jxha:dc"
      >
        <AlertDialogContent data-oid="qhxmhin">
          <AlertDialogHeader data-oid="touccdr">
            <AlertDialogTitle data-oid="s4a0jgw">
              確定要執行刪除嗎？
            </AlertDialogTitle>
            <AlertDialogDescription data-oid="62ghj-u">
              你正準備刪除用戶「{userToDelete?.name}」。此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter data-oid="or59qg6">
            <AlertDialogCancel
              onClick={() => setUserToDelete(null)}
              data-oid="gizwydy"
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (userToDelete) {
                  handleDeleteUser(userToDelete);
                }
              }}
              disabled={deleteUserMutation.isPending}
              data-oid="-yivkk7"
            >
              {deleteUserMutation.isPending ? "刪除中..." : "確定刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 用戶分店管理對話框 */}
      {selectedUserForStores && (
        <UserStoresDialog
          userId={selectedUserForStores.id as number}
          userName={selectedUserForStores.name as string}
          open={isStoresDialogOpen}
          onOpenChange={setIsStoresDialogOpen}
          data-oid="_ou37qk"
        />
      )}
    </div>
  );
}
