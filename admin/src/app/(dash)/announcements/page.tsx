import { AnnouncementManagement } from "@/components/admin/announcement-management";

export default function AdminAnnouncementsPage() {
    return (
        <div className="space-y-4 max-w-3xl">
            <h1 className="text-2xl font-bold">公告管理</h1>
            <AnnouncementManagement />
        </div>
    );
}
