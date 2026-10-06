import { PageHeader } from "@/components/page-header";
import { AnnouncementManagement } from "@/components/admin/announcement-management";

export default function AdminAnnouncementsPage() {
    return (
        <div>
            <PageHeader
                title="公告管理"
                description="发布与管理系统公告，学习端用户将实时收到通知"
            />
            <AnnouncementManagement />
        </div>
    );
}
