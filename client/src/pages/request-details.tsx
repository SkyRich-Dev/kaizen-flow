import { useAuth } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Clock,
  Briefcase,
  ArrowRight,
  Download,
  Loader2,
  Info,
  Building,
  Users
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requestsApi, hodApi, managerApi, approvalsApi } from "@/lib/api";
import { DEPARTMENT_DISPLAY_NAMES, DEPARTMENT_EVALUATION_QUESTIONS, type DepartmentType, DEPARTMENTS } from "@/lib/types";
import { DepartmentEvaluationForm } from "@/components/department-evaluation-form";

export default function RequestDetailsPage({ id }: { id: string }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: request, isLoading, error } = useQuery({
    queryKey: ['request', id],
    queryFn: () => requestsApi.getByRequestId(id),
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [costJustification, setCostJustification] = useState("");

  const ownManagerMutation = useMutation({
    mutationFn: (data: { decision: 'APPROVED' | 'REJECTED'; remarks?: string }) => 
      managerApi.submitOwnManagerDecision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast({ title: "Decision Submitted", description: "Own Manager decision recorded successfully." });
      setApprovalRemarks("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const ownHodMutation = useMutation({
    mutationFn: (data: { decision: 'APPROVED' | 'REJECTED'; remarks?: string }) => 
      hodApi.submitOwnHodDecision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast({ title: "Decision Submitted", description: "Own HOD decision recorded successfully." });
      setApprovalRemarks("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const crossHodMutation = useMutation({
    mutationFn: (data: { decision: 'APPROVED' | 'REJECTED'; remarks?: string }) => 
      hodApi.submitCrossHodDecision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast({ title: "Decision Submitted", description: "Cross-HOD decision recorded successfully." });
      setApprovalRemarks("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const crossManagerMutation = useMutation({
    mutationFn: (data: { decision: 'APPROVED' | 'REJECTED'; remarks?: string }) => 
      managerApi.submitCrossManagerDecision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast({ title: "Decision Submitted", description: "Manager decision recorded successfully." });
      setApprovalRemarks("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const agmMutation = useMutation({
    mutationFn: (data: any) => approvalsApi.submitAgmDecision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast({ title: "AGM Decision Submitted", description: "Decision recorded successfully." });
      setApprovalRemarks("");
      setCostJustification("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const gmMutation = useMutation({
    mutationFn: (data: any) => approvalsApi.submitGmDecision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast({ title: "GM Decision Submitted", description: "Final decision recorded successfully." });
      setApprovalRemarks("");
      setCostJustification("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {error ? "Failed to load request" : "Request not found"}
      </div>
    );
  }

  const isHOD = currentUser?.role === 'HOD';
  const isManager = currentUser?.role === 'MANAGER';
  const isAGM = currentUser?.role === 'AGM';
  const isGM = currentUser?.role === 'GM';
  const isAdmin = currentUser?.role === 'ADMIN';
  const isAGMorGM = isAGM || isGM;
  const isInitiator = currentUser?.role === 'INITIATOR';

  const ownManagerApproval = request.managerApprovals?.find((a: any) => a.stageType === 'OWN_MANAGER');
  const crossManagerApprovals = request.managerApprovals?.filter((a: any) => a.stageType === 'CROSS_MANAGER') || [];
  const ownHodApproval = request.hodApprovals?.find((a: any) => a.stageType === 'OWN_HOD');
  const crossHodApprovals = request.hodApprovals?.filter((a: any) => a.stageType === 'CROSS_HOD') || [];

  const isOwnDeptHOD = isHOD && currentUser?.department === request.department;
  const isCrossDeptHOD = isHOD && currentUser?.department !== request.department;
  const isOwnDeptManager = isManager && currentUser?.department === request.department;
  const isCrossDeptManager = isManager && currentUser?.department !== request.department;
  
  const canApproveOwnManager = isOwnDeptManager && request.status === 'PENDING_OWN_MANAGER';
  const canApproveOwnHOD = isOwnDeptHOD && request.status === 'PENDING_OWN_HOD';
  const canApproveCrossManager = isManager && 
    request.status === 'PENDING_CROSS_MANAGER' &&
    currentUser?.department !== request.department &&
    !crossManagerApprovals.some((a: any) => a.departmentName === currentUser?.department);
  const canApproveCrossHOD = isHOD && 
    request.status === 'PENDING_CROSS_HOD' &&
    currentUser?.department !== request.department &&
    !crossHodApprovals.some((a: any) => a.departmentName === currentUser?.department);
  const canApproveAGM = isAGM && request.status === 'PENDING_AGM';
  const canApproveGM = isGM && request.status === 'PENDING_GM';

  const canTakeAction = canApproveOwnManager || canApproveOwnHOD || canApproveCrossManager || canApproveCrossHOD || canApproveAGM || canApproveGM;
  const isReadOnly = !canTakeAction && !isInitiator && !isAdmin;

  const handleOwnManagerSubmit = (decision: 'APPROVED' | 'REJECTED') => {
    if (decision === 'REJECTED' && !approvalRemarks) {
      toast({ title: "Error", description: "Remarks are mandatory for rejection.", variant: "destructive" });
      return;
    }
    ownManagerMutation.mutate({ decision, remarks: approvalRemarks });
  };

  const handleOwnHodSubmit = (decision: 'APPROVED' | 'REJECTED') => {
    if (decision === 'REJECTED' && !approvalRemarks) {
      toast({ title: "Error", description: "Remarks are mandatory for rejection.", variant: "destructive" });
      return;
    }
    ownHodMutation.mutate({ decision, remarks: approvalRemarks });
  };

  const handleCrossHodSubmit = (decision: 'APPROVED' | 'REJECTED') => {
    if (decision === 'REJECTED' && !approvalRemarks) {
      toast({ title: "Error", description: "Remarks are mandatory for rejection.", variant: "destructive" });
      return;
    }
    crossHodMutation.mutate({ decision, remarks: approvalRemarks });
  };

  const handleCrossManagerSubmit = (decision: 'APPROVED' | 'REJECTED') => {
    if (decision === 'REJECTED' && !approvalRemarks) {
      toast({ title: "Error", description: "Remarks are mandatory for rejection.", variant: "destructive" });
      return;
    }
    crossManagerMutation.mutate({ decision, remarks: approvalRemarks });
  };

  const handleAGMSubmit = (approved: boolean) => {
    if (!approved && !approvalRemarks) {
      toast({ title: "Error", description: "Comments are mandatory for rejection.", variant: "destructive" });
      return;
    }
    agmMutation.mutate({ approved, comments: approvalRemarks, cost_justification: costJustification });
  };

  const handleGMSubmit = (approved: boolean) => {
    if (!approved && !approvalRemarks) {
      toast({ title: "Error", description: "Comments are mandatory for rejection.", variant: "destructive" });
      return;
    }
    gmMutation.mutate({ approved, comments: approvalRemarks, cost_justification: costJustification });
  };

  const getWorkflowSteps = () => {
    const isRejected = request.status === 'REJECTED';
    const rejectionStage = request.currentStage;
    
    const steps = [
      { 
        label: 'Initiated', 
        status: 'COMPLETED' as const, 
        date: request.createdAt 
      },
      { 
        label: 'Own Manager', 
        status: request.status === 'PENDING_OWN_MANAGER' ? 'CURRENT' : 
                (isRejected && rejectionStage === 'OWN_MANAGER') ? 'REJECTED' :
                ownManagerApproval ? 'COMPLETED' : 'PENDING',
        date: ownManagerApproval?.createdAt 
      },
      { 
        label: 'Own HOD', 
        status: request.status === 'PENDING_OWN_HOD' ? 'CURRENT' : 
                (isRejected && rejectionStage === 'OWN_HOD') ? 'REJECTED' :
                ownHodApproval ? 'COMPLETED' : 'PENDING',
        date: ownHodApproval?.createdAt 
      },
      { 
        label: 'Cross-Managers', 
        status: request.status === 'PENDING_CROSS_MANAGER' ? 'CURRENT' : 
                (isRejected && rejectionStage === 'CROSS_MANAGER') ? 'REJECTED' :
                (crossManagerApprovals?.length >= 4) ? 'COMPLETED' : 'PENDING',
        date: null
      },
      { 
        label: 'Cross-HOD', 
        status: request.status === 'PENDING_CROSS_HOD' ? 'CURRENT' : 
                (isRejected && rejectionStage === 'CROSS_HOD') ? 'REJECTED' :
                (crossHodApprovals?.length >= 4) ? 'COMPLETED' : 'PENDING',
        date: null
      },
      { 
        label: 'AGM', 
        status: request.status === 'PENDING_AGM' ? 'CURRENT' : 
                (isRejected && rejectionStage === 'AGM') ? 'REJECTED' :
                request.agmApproval ? 'COMPLETED' : 'PENDING',
        date: request.agmApproval?.approvedAt 
      },
      { 
        label: 'GM', 
        status: request.status === 'PENDING_GM' ? 'CURRENT' : 
                (isRejected && rejectionStage === 'GM') ? 'REJECTED' :
                request.gmApproval ? 'COMPLETED' : 'PENDING',
        date: request.gmApproval?.approvedAt 
      },
      { 
        label: 'Final', 
        status: request.status === 'APPROVED' ? 'COMPLETED' : 
                isRejected ? 'REJECTED' : 'PENDING',
        date: null 
      }
    ];
    return steps;
  };

  const steps = getWorkflowSteps();

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="font-mono text-xs">{request.requestId}</Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Created: {new Date(request.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">{request.title}</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> 
            {DEPARTMENT_DISPLAY_NAMES[request.department as DepartmentType] || request.department} Department
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StatusBadge status={request.status} className="text-sm px-4 py-1.5" />
          
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileText className="mr-2 h-4 w-4" /> Print Record
            </Button>
            {canTakeAction && (
              <Button size="sm" onClick={() => setActiveTab("approval")} data-testid="btn-take-action">
                Take Action
              </Button>
            )}
          </div>

          {request.rejectionReason && (
            <div className="text-xs text-red-600 font-medium bg-red-50 px-3 py-1 rounded-md border border-red-100 flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              {request.rejectionReason}
            </div>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3" data-testid="read-only-banner">
          <Info className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Read-only view</p>
            <p className="text-xs text-blue-600">This request is not pending your action. You can view all details but cannot take action.</p>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto pb-4">
        <div className="flex items-center justify-between min-w-[900px] relative">
          <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-10" />
          
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2 bg-background px-2 z-0">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors",
                step.status === 'COMPLETED' ? "bg-emerald-500 border-emerald-500 text-white" :
                step.status === 'CURRENT' ? "bg-blue-100 border-blue-500 text-blue-700 animate-pulse" :
                step.status === 'REJECTED' ? "bg-red-500 border-red-500 text-white" :
                "bg-muted border-muted-foreground/30 text-muted-foreground"
              )}>
                {step.status === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4" /> :
                 step.status === 'REJECTED' ? <XCircle className="h-4 w-4" /> :
                 <span className="text-xs font-bold">{idx + 1}</span>}
              </div>
              <div className="text-center">
                <p className={cn("text-xs font-medium", step.status === 'CURRENT' ? "text-blue-700" : "text-muted-foreground")}>
                  {step.label}
                </p>
                {step.date && <p className="text-[10px] text-muted-foreground">{new Date(step.date).toLocaleDateString()}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-l-4 border-l-primary h-fit sticky top-20">
            <CardHeader className="bg-muted/10 pb-3">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Request Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <Label className="text-xs text-muted-foreground">Station Name</Label>
                <p className="font-medium">{request.stationName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Program</Label>
                <p className="font-medium">{request.program}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Part Number</Label>
                <p className="font-medium">{request.customerPartNumber}</p>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground">Cost Estimate</Label>
                <p className="text-xl font-bold text-emerald-700">₹{request.costEstimate?.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Process Addition</span>
                  <Badge variant={request.requiresProcessAddition ? "default" : "secondary"}>
                    {request.requiresProcessAddition ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Manpower Addition</span>
                  <Badge variant={request.requiresManpowerAddition ? "default" : "secondary"}>
                    {request.requiresManpowerAddition ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground">Initiator</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-bold">
                    {(request.initiatorName || request.initiatorId)?.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm">{request.initiatorName || request.initiatorId}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-[500px] mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="approval">HOD Approvals</TabsTrigger>
              <TabsTrigger value="history">Decision History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in-50">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Full Details & Routing Logic
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Issue Description</h4>
                    <p className="text-sm leading-relaxed bg-muted/20 p-4 rounded-md border">{request.issueDescription}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-blue-50/50 border-blue-100">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-blue-800">Workflow Path</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <div className="flex items-start gap-2 text-blue-700">
                          <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>Initiator → <strong>Own Department HOD</strong></span>
                        </div>
                        <div className="flex items-start gap-2 text-blue-700">
                          <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>→ <strong>All Other Department HODs</strong></span>
                        </div>
                        <div className="flex items-start gap-2 text-blue-700">
                          <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>→ <strong>AGM</strong> → <strong>GM</strong> → Final</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Attachments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {request.attachments && request.attachments.length > 0 ? (
                          <ul className="space-y-2">
                            {request.attachments.map((file: any, i: number) => (
                              <li key={i} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                                <span className="flex items-center gap-2"><FileText className="h-3 w-3"/> {file.fileName || file.name}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6"><Download className="h-3 w-3"/></Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No documents attached.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="approval" className="space-y-6 animate-in fade-in-50">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    HOD Approval Status
                  </CardTitle>
                  <CardDescription>Track approvals from all department heads</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {request.ownHodApproval && (
                    <div className={cn(
                      "p-4 rounded-lg border-l-4",
                      request.ownHodApproval.decision === 'APPROVED' ? "bg-emerald-50 border-l-emerald-500" : "bg-red-50 border-l-red-500"
                    )}>
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant="outline" className="mb-2">Own Department HOD</Badge>
                          <p className="text-sm font-medium">
                            {DEPARTMENT_DISPLAY_NAMES[request.ownHodApproval.department as DepartmentType]} - {request.ownHodApproval.hodUserName}
                          </p>
                          {request.ownHodApproval.remarks && (
                            <p className="text-sm text-muted-foreground mt-1 italic">"{request.ownHodApproval.remarks}"</p>
                          )}
                        </div>
                        <Badge variant={request.ownHodApproval.decision === 'APPROVED' ? "default" : "destructive"}>
                          {request.ownHodApproval.decision}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {request.crossHodApprovals && request.crossHodApprovals.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Cross-Department HOD Approvals</h4>
                      {request.crossHodApprovals.map((approval: any, idx: number) => (
                        <div key={idx} className={cn(
                          "p-3 rounded-lg border-l-4",
                          approval.decision === 'APPROVED' ? "bg-emerald-50/50 border-l-emerald-400" : "bg-red-50/50 border-l-red-400"
                        )}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium">
                                {DEPARTMENT_DISPLAY_NAMES[approval.department as DepartmentType]} - {approval.hodUserName}
                              </p>
                              {approval.remarks && (
                                <p className="text-xs text-muted-foreground italic">"{approval.remarks}"</p>
                              )}
                            </div>
                            <Badge variant={approval.decision === 'APPROVED' ? "default" : "destructive"} className="text-xs">
                              {approval.decision}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {request.pendingHods && request.pendingHods.length > 0 && request.status === 'PENDING_CROSS_HOD' && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Pending HOD Approvals
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {request.pendingHods.map((dept: DepartmentType) => (
                          <Badge key={dept} variant="outline" className="bg-white">
                            {DEPARTMENT_DISPLAY_NAMES[dept]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {canApproveOwnManager && (
                    <Card className="border-2 border-blue-200 shadow-lg mt-6">
                      <CardHeader className="bg-blue-50">
                        <CardTitle>Own Department Manager Review</CardTitle>
                        <CardDescription>
                          As the Manager of {DEPARTMENT_DISPLAY_NAMES[currentUser?.department as DepartmentType]}, please review and decide.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        <div>
                          <Label>Remarks {<span className="text-muted-foreground">(required for rejection)</span>}</Label>
                          <Textarea 
                            placeholder="Enter your remarks..." 
                            value={approvalRemarks}
                            onChange={(e) => setApprovalRemarks(e.target.value)}
                            data-testid="input-own-manager-remarks"
                          />
                        </div>
                        <div className="flex gap-4">
                          <Button 
                            onClick={() => handleOwnManagerSubmit('APPROVED')} 
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            disabled={ownManagerMutation.isPending}
                            data-testid="btn-own-manager-approve"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve & Forward to HOD
                          </Button>
                          <Button 
                            variant="destructive" 
                            onClick={() => handleOwnManagerSubmit('REJECTED')} 
                            className="flex-1"
                            disabled={ownManagerMutation.isPending}
                            data-testid="btn-own-manager-reject"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {canApproveOwnHOD && (
                    <Card className="border-2 border-primary/20 shadow-lg mt-6">
                      <CardHeader className="bg-primary/5">
                        <CardTitle>Own Department HOD Decision</CardTitle>
                        <CardDescription>
                          As the HOD of {DEPARTMENT_DISPLAY_NAMES[currentUser?.department as DepartmentType]}, please review and decide.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        <div>
                          <Label>Remarks {<span className="text-muted-foreground">(required for rejection)</span>}</Label>
                          <Textarea 
                            placeholder="Enter your remarks..." 
                            value={approvalRemarks}
                            onChange={(e) => setApprovalRemarks(e.target.value)}
                            data-testid="input-remarks"
                          />
                        </div>
                        <div className="flex gap-4">
                          <Button 
                            onClick={() => handleOwnHodSubmit('APPROVED')} 
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            disabled={ownHodMutation.isPending}
                            data-testid="btn-approve"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve & Forward
                          </Button>
                          <Button 
                            variant="destructive" 
                            onClick={() => handleOwnHodSubmit('REJECTED')} 
                            className="flex-1"
                            disabled={ownHodMutation.isPending}
                            data-testid="btn-reject"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {canApproveCrossManager && currentUser?.department && (
                    <div className="mt-6">
                      {DEPARTMENT_EVALUATION_QUESTIONS[currentUser.department as DepartmentType] ? (
                        <DepartmentEvaluationForm
                          requestId={id}
                          userDepartment={currentUser.department as DepartmentType}
                          userRole="MANAGER"
                          requestDepartment={request.department as DepartmentType}
                        />
                      ) : (
                        <Card className="border-2 border-indigo-200 shadow-lg">
                          <CardHeader className="bg-indigo-50">
                            <CardTitle>Cross-Department Manager Review</CardTitle>
                            <CardDescription>
                              As the Manager of {DEPARTMENT_DISPLAY_NAMES[currentUser?.department as DepartmentType]}, 
                              review this request from {DEPARTMENT_DISPLAY_NAMES[request.department as DepartmentType]}.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4 pt-4">
                            <div>
                              <Label>Remarks {<span className="text-muted-foreground">(required for rejection)</span>}</Label>
                              <Textarea 
                                placeholder="Enter your remarks..." 
                                value={approvalRemarks}
                                onChange={(e) => setApprovalRemarks(e.target.value)}
                                data-testid="input-cross-manager-remarks"
                              />
                            </div>
                            <div className="flex gap-4">
                              <Button 
                                onClick={() => handleCrossManagerSubmit('APPROVED')} 
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                disabled={crossManagerMutation.isPending}
                                data-testid="btn-cross-manager-approve"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve
                              </Button>
                              <Button 
                                variant="destructive" 
                                onClick={() => handleCrossManagerSubmit('REJECTED')} 
                                className="flex-1"
                                disabled={crossManagerMutation.isPending}
                                data-testid="btn-cross-manager-reject"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {canApproveCrossHOD && currentUser?.department && (
                    <div className="mt-6">
                      {DEPARTMENT_EVALUATION_QUESTIONS[currentUser.department as DepartmentType] ? (
                        <DepartmentEvaluationForm
                          requestId={id}
                          userDepartment={currentUser.department as DepartmentType}
                          userRole="HOD"
                          requestDepartment={request.department as DepartmentType}
                          existingManagerEvaluation={request.managerEvaluations?.find(
                            (e: any) => e.department === currentUser.department
                          )}
                        />
                      ) : (
                        <Card className="border-2 border-purple-200 shadow-lg">
                          <CardHeader className="bg-purple-50">
                            <CardTitle>Cross-Department HOD Decision</CardTitle>
                            <CardDescription>
                              As the HOD of {DEPARTMENT_DISPLAY_NAMES[currentUser?.department as DepartmentType]}, 
                              review this request from {DEPARTMENT_DISPLAY_NAMES[request.department as DepartmentType]}.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4 pt-4">
                            <div>
                              <Label>Remarks {<span className="text-muted-foreground">(required for rejection)</span>}</Label>
                              <Textarea 
                                placeholder="Enter your remarks..." 
                                value={approvalRemarks}
                                onChange={(e) => setApprovalRemarks(e.target.value)}
                                data-testid="input-remarks"
                              />
                            </div>
                            <div className="flex gap-4">
                              <Button 
                                onClick={() => handleCrossHodSubmit('APPROVED')} 
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                disabled={crossHodMutation.isPending}
                                data-testid="btn-approve"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve
                              </Button>
                              <Button 
                                variant="destructive" 
                                onClick={() => handleCrossHodSubmit('REJECTED')} 
                                className="flex-1"
                                disabled={crossHodMutation.isPending}
                                data-testid="btn-reject"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {canApproveAGM && (
                    <Card className="border-2 border-orange-200 shadow-lg mt-6">
                      <CardHeader className="bg-orange-50">
                        <CardTitle>AGM Decision</CardTitle>
                        <CardDescription>All department HODs have approved. Please review and decide.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        <div>
                          <Label>Cost Justification</Label>
                          <Textarea 
                            placeholder="Enter cost justification..." 
                            value={costJustification}
                            onChange={(e) => setCostJustification(e.target.value)}
                            data-testid="input-cost-justification"
                          />
                        </div>
                        <div>
                          <Label>Comments {<span className="text-muted-foreground">(required for rejection)</span>}</Label>
                          <Textarea 
                            placeholder="Enter comments..." 
                            value={approvalRemarks}
                            onChange={(e) => setApprovalRemarks(e.target.value)}
                            data-testid="input-comments"
                          />
                        </div>
                        <div className="flex gap-4">
                          <Button 
                            onClick={() => handleAGMSubmit(true)} 
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            disabled={agmMutation.isPending}
                            data-testid="btn-agm-approve"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve & Forward to GM
                          </Button>
                          <Button 
                            variant="destructive" 
                            onClick={() => handleAGMSubmit(false)} 
                            className="flex-1"
                            disabled={agmMutation.isPending}
                            data-testid="btn-agm-reject"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {canApproveGM && (
                    <Card className="border-2 border-amber-200 shadow-lg mt-6">
                      <CardHeader className="bg-amber-50">
                        <CardTitle>GM Final Decision</CardTitle>
                        <CardDescription>This is the final approval step. Your decision is binding.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        <div>
                          <Label>Cost Justification</Label>
                          <Textarea 
                            placeholder="Enter cost justification..." 
                            value={costJustification}
                            onChange={(e) => setCostJustification(e.target.value)}
                            data-testid="input-cost-justification"
                          />
                        </div>
                        <div>
                          <Label>Comments {<span className="text-muted-foreground">(required for rejection)</span>}</Label>
                          <Textarea 
                            placeholder="Enter comments..." 
                            value={approvalRemarks}
                            onChange={(e) => setApprovalRemarks(e.target.value)}
                            data-testid="input-comments"
                          />
                        </div>
                        <div className="flex gap-4">
                          <Button 
                            onClick={() => handleGMSubmit(true)} 
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            disabled={gmMutation.isPending}
                            data-testid="btn-gm-approve"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Final Approve
                          </Button>
                          <Button 
                            variant="destructive" 
                            onClick={() => handleGMSubmit(false)} 
                            className="flex-1"
                            disabled={gmMutation.isPending}
                            data-testid="btn-gm-reject"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Final Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-6 animate-in fade-in-50">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Decision History
                  </CardTitle>
                  <CardDescription>Complete audit trail of all decisions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">Created</Badge>
                        <span className="text-muted-foreground">by {request.initiatorName || request.initiatorId}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(request.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {request.ownHodApproval && (
                      <div className={cn(
                        "p-3 rounded-lg",
                        request.ownHodApproval.decision === 'APPROVED' ? "bg-emerald-50" : "bg-red-50"
                      )}>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant={request.ownHodApproval.decision === 'APPROVED' ? "default" : "destructive"}>
                            Own HOD {request.ownHodApproval.decision}
                          </Badge>
                          <span className="text-muted-foreground">
                            by {request.ownHodApproval.hodUserName} ({DEPARTMENT_DISPLAY_NAMES[request.ownHodApproval.department as DepartmentType]})
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(request.ownHodApproval.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {request.ownHodApproval.remarks && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{request.ownHodApproval.remarks}"</p>
                        )}
                      </div>
                    )}

                    {request.crossHodApprovals?.map((approval: any, idx: number) => (
                      <div key={idx} className={cn(
                        "p-3 rounded-lg",
                        approval.decision === 'APPROVED' ? "bg-emerald-50/50" : "bg-red-50/50"
                      )}>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant={approval.decision === 'APPROVED' ? "default" : "destructive"}>
                            Cross-HOD {approval.decision}
                          </Badge>
                          <span className="text-muted-foreground">
                            by {approval.hodUserName} ({DEPARTMENT_DISPLAY_NAMES[approval.department as DepartmentType]})
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(approval.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {approval.remarks && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{approval.remarks}"</p>
                        )}
                      </div>
                    ))}

                    {request.agmApproval && (
                      <div className={cn(
                        "p-3 rounded-lg",
                        request.agmApproval.approved ? "bg-emerald-50" : "bg-red-50"
                      )}>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant={request.agmApproval.approved ? "default" : "destructive"}>
                            AGM {request.agmApproval.approved ? 'APPROVED' : 'REJECTED'}
                          </Badge>
                          <span className="text-muted-foreground">by {request.agmApproval.approvedByName}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(request.agmApproval.approvedAt).toLocaleString()}
                          </span>
                        </div>
                        {request.agmApproval.comments && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{request.agmApproval.comments}"</p>
                        )}
                      </div>
                    )}

                    {request.gmApproval && (
                      <div className={cn(
                        "p-3 rounded-lg",
                        request.gmApproval.approved ? "bg-emerald-50" : "bg-red-50"
                      )}>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant={request.gmApproval.approved ? "default" : "destructive"}>
                            GM FINAL {request.gmApproval.approved ? 'APPROVED' : 'REJECTED'}
                          </Badge>
                          <span className="text-muted-foreground">by {request.gmApproval.approvedByName}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(request.gmApproval.approvedAt).toLocaleString()}
                          </span>
                        </div>
                        {request.gmApproval.comments && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{request.gmApproval.comments}"</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
