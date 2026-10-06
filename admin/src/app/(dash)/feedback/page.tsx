import { FeedbackManagement } from "@/components/admin/feedback-management";

export default function AdminFeedbackPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">反馈管理</h1>
            <FeedbackManagement />
        </div>
    );
}
