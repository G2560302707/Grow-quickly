import { PageHeader } from "@/components/page-header";
import { FeedbackManagement } from "@/components/admin/feedback-management";

export default function AdminFeedbackPage() {
    return (
        <div>
            <PageHeader
                title="反馈管理"
                description="查看与处理用户提交的反馈"
            />
            <FeedbackManagement />
        </div>
    );
}
