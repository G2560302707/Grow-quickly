import { UserManagement } from "@/components/admin/user-management";

export default function AdminUsersPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">用户管理</h1>
            <UserManagement />
        </div>
    );
}
