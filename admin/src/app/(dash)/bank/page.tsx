import { PageHeader } from "@/components/page-header";
import { BankManagement } from "@/components/admin/bank-management";

export default function AdminBankPage() {
    return (
        <div>
            <PageHeader
                title="题库管理"
                description="导入题册 → AI 离线解析分类 → 审核发布；出题时优先从题库检索，命中即毫秒返回"
            />
            <BankManagement />
        </div>
    );
}
