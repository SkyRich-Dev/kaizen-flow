import { Badge } from "@/components/ui/badge";
import { RequestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<RequestStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground hover:bg-muted/80" },
  PENDING_OWN_HOD: { label: "Pending Own HOD", className: "bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-blue-200" },
  OWN_HOD_REJECTED: { label: "Own HOD Rejected", className: "bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200" },
  PENDING_CROSS_MANAGER: { label: "Pending Managers", className: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100/80 border-indigo-200" },
  MANAGER_REJECTED: { label: "Manager Rejected", className: "bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200" },
  PENDING_CROSS_HOD: { label: "Pending Cross-HOD", className: "bg-purple-100 text-purple-700 hover:bg-purple-100/80 border-purple-200" },
  CROSS_HOD_REJECTED: { label: "Cross-HOD Rejected", className: "bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200" },
  PENDING_AGM: { label: "Pending AGM", className: "bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200" },
  AGM_REJECTED: { label: "AGM Rejected", className: "bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200" },
  PENDING_GM: { label: "Pending GM", className: "bg-amber-100 text-amber-700 hover:bg-amber-100/80 border-amber-200" },
  APPROVED: { label: "Final Approved", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100/80 border-emerald-200" },
  REJECTED: { label: "Final Rejected", className: "bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200" },
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const config = statusConfig[status] || statusConfig.DRAFT;
  
  return (
    <Badge variant="outline" className={cn("font-medium border shadow-sm", config.className, className)}>
      {config.label}
    </Badge>
  );
}
