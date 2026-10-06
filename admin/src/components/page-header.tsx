import { cn } from "@/lib/utils";

/**
 * 统一页头：标题 + 描述 + 右侧操作区（actions）。
 * 所有管理端页面使用同一页头样式，保持格局一致。
 */
export function PageHeader({
    title,
    description,
    actions,
    className,
}: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-wrap items-start justify-between gap-4 pb-6", className)}>
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
