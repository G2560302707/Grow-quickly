import { PageHeader } from "@/components/page-header";
import { UserManagement } from "@/components/admin/user-management";

export default function AdminUsersPage() {
    return (
        <div>
            <PageHeader
                title="用户管理"
                description="管理注册用户、注册开关与账号状态"
            />
            <UserManagement />
        </div>
    );
}
