import { useAuth } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "wouter";
import { Plus, Search, Filter, Loader2, AlertCircle, Users, Settings, Eye, Check, Info, Building } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { requestsApi } from "@/lib/api";
import { DEPARTMENTS, DEPARTMENT_DISPLAY_NAMES, type DepartmentType } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'PENDING_OWN_HOD', label: 'Pending Own HOD' },
  { value: 'PENDING_CROSS_MANAGER', label: 'Pending Managers' },
  { value: 'MANAGER_REJECTED', label: 'Manager Rejected' },
  { value: 'PENDING_CROSS_HOD', label: 'Pending Cross-HOD' },
  { value: 'PENDING_AGM', label: 'Pending AGM' },
  { value: 'PENDING_GM', label: 'Pending GM' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'OWN_HOD_REJECTED', label: 'Own HOD Rejected' },
  { value: 'CROSS_HOD_REJECTED', label: 'Cross-HOD Rejected' },
  { value: 'AGM_REJECTED', label: 'AGM Rejected' },
  { value: 'REJECTED', label: 'Rejected' },
];

const DEPARTMENT_OPTIONS = [
  { value: 'all', label: 'All Departments' },
  ...DEPARTMENTS.map(d => ({ value: d, label: DEPARTMENT_DISPLAY_NAMES[d] }))
];

function getCostBand(cost: number): 'low' | 'medium' | 'high' {
  if (cost <= 50000) return 'low';
  if (cost <= 100000) return 'medium';
  return 'high';
}

function CostBandBadge({ cost }: { cost: number }) {
  const band = getCostBand(cost);
  const colors = {
    low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    medium: 'bg-amber-100 text-amber-800 border-amber-200',
    high: 'bg-red-100 text-red-800 border-red-200',
  };
  const labels = { low: '≤50k', medium: '50k-100k', high: '>100k' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[band]}`}>
      {labels[band]}
    </span>
  );
}

function EscalationFlags({ requiresProcessAddition, requiresManpowerAddition }: { requiresProcessAddition?: boolean, requiresManpowerAddition?: boolean }) {
  if (!requiresProcessAddition && !requiresManpowerAddition) return null;
  return (
    <div className="flex gap-1">
      {requiresProcessAddition && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                <Settings className="h-3 w-3 mr-1" />
                Process
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Process Addition Required</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {requiresManpowerAddition && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                <Users className="h-3 w-3 mr-1" />
                Manpower
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Manpower Addition Required</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

function getCurrentStageName(status: string): string {
  switch (status) {
    case 'PENDING_OWN_HOD': return 'Own HOD Review';
    case 'PENDING_CROSS_MANAGER': return 'Manager Review';
    case 'MANAGER_REJECTED': return 'Rejected by Manager';
    case 'PENDING_CROSS_HOD': return 'Cross-HOD Approval';
    case 'PENDING_AGM': return 'AGM Approval';
    case 'PENDING_GM': return 'GM Approval';
    case 'APPROVED': return 'Approved';
    case 'OWN_HOD_REJECTED': return 'Rejected by Own HOD';
    case 'CROSS_HOD_REJECTED': return 'Rejected by Cross-HOD';
    case 'AGM_REJECTED': return 'Rejected by AGM';
    case 'REJECTED': return 'Final Rejected';
    default: return status;
  }
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['requests'],
    queryFn: requestsApi.getAll,
  });

  const isHOD = currentUser?.role === 'HOD';
  const isManager = currentUser?.role === 'MANAGER';
  const isAGM = currentUser?.role === 'AGM';
  const isGM = currentUser?.role === 'GM';
  const isAGMorGM = isAGM || isGM;
  const isInitiator = currentUser?.role === 'INITIATOR';

  const applyFilters = (reqs: any[]) => {
    return reqs.filter(req => {
      const matchesSearch = req.title?.toLowerCase().includes(search.toLowerCase()) || 
                            req.requestId?.toLowerCase().includes(search.toLowerCase()) ||
                            req.stationName?.toLowerCase().includes(search.toLowerCase());
      
      if (!matchesSearch) return false;
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (departmentFilter !== 'all' && req.department !== departmentFilter) return false;
      
      return true;
    });
  };

  const ownDeptRequests = useMemo(() => {
    if (!isHOD || !currentUser?.department) return [];
    return applyFilters(requests.filter(req => 
      req.department === currentUser.department && req.status === 'PENDING_OWN_HOD'
    ));
  }, [requests, currentUser, search, statusFilter, departmentFilter, isHOD]);

  const crossDeptRequests = useMemo(() => {
    if (!isHOD || !currentUser?.department) return [];
    return applyFilters(requests.filter(req => 
      req.department !== currentUser.department && 
      req.status === 'PENDING_CROSS_HOD' &&
      !req.crossHodApprovals?.some((a: any) => a.department === currentUser.department)
    ));
  }, [requests, currentUser, search, statusFilter, departmentFilter, isHOD]);

  const managerActionableRequests = useMemo(() => {
    if (!isManager || !currentUser?.department) return [];
    return applyFilters(requests.filter(req => 
      req.department !== currentUser.department && 
      req.status === 'PENDING_CROSS_MANAGER' &&
      !req.managerApprovals?.some((a: any) => a.department === currentUser.department)
    ));
  }, [requests, currentUser, search, statusFilter, departmentFilter, isManager]);

  const agmActionableRequests = useMemo(() => {
    if (!isAGM) return [];
    return applyFilters(requests.filter(req => req.status === 'PENDING_AGM'));
  }, [requests, currentUser, search, statusFilter, departmentFilter, isAGM]);

  const gmActionableRequests = useMemo(() => {
    if (!isGM) return [];
    return applyFilters(requests.filter(req => req.status === 'PENDING_GM'));
  }, [requests, currentUser, search, statusFilter, departmentFilter, isGM]);

  const initiatorRequests = useMemo(() => {
    if (!isInitiator) return [];
    return applyFilters(requests.filter(req => req.initiatorId === currentUser?.id));
  }, [requests, currentUser, search, statusFilter, departmentFilter, isInitiator]);

  const allRequests = useMemo(() => {
    return applyFilters(requests);
  }, [requests, search, statusFilter, departmentFilter]);

  const FilterSection = () => (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg ${showFilters ? '' : 'hidden'}`}>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Department</label>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger data-testid="filter-department">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const RequestsTable = ({ data, showDept = true }: { data: any[], showDept?: boolean }) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Kaizen ID</TableHead>
            <TableHead>Station / Title</TableHead>
            {showDept && <TableHead>Department</TableHead>}
            <TableHead>Cost</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showDept ? 8 : 7} className="text-center py-8 text-muted-foreground">
                No requests found matching your criteria.
              </TableCell>
            </TableRow>
          ) : (
            data.map((req) => (
              <TableRow key={req.id} className="hover:bg-muted/5 transition-colors">
                <TableCell className="font-mono text-xs text-muted-foreground">{req.requestId}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{req.stationName}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{req.title}</span>
                  </div>
                </TableCell>
                {showDept && (
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                      {DEPARTMENT_DISPLAY_NAMES[req.department as DepartmentType] || req.department}
                    </span>
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span>₹{req.costEstimate?.toLocaleString()}</span>
                    <CostBandBadge cost={req.costEstimate} />
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{getCurrentStageName(req.status)}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={req.status} />
                </TableCell>
                <TableCell>
                  <EscalationFlags 
                    requiresProcessAddition={req.requiresProcessAddition} 
                    requiresManpowerAddition={req.requiresManpowerAddition} 
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/requests/${req.requestId}`}>
                    <Button variant="ghost" size="sm" className="h-8 gap-1" data-testid={`view-request-${req.requestId}`}>
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (isManager) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Manager Dashboard - {DEPARTMENT_DISPLAY_NAMES[currentUser?.department as DepartmentType]}
            </h2>
            <p className="text-muted-foreground mt-1">
              Review cross-department requests requiring manager approval.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card shadow-sm border-border/60 border-l-4 border-l-indigo-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending My Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{managerActionableRequests.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {requests.filter((r: any) => r.status === 'APPROVED').length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Managers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {requests.filter((r: any) => r.status === 'PENDING_CROSS_MANAGER').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="action" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="action" className="gap-2" data-testid="tab-action-required">
              <AlertCircle className="h-4 w-4" />
              Requires My Action ({managerActionableRequests.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2" data-testid="tab-all-requests">
              <Eye className="h-4 w-4" />
              All Requests ({allRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="action">
            <Card className="shadow-md border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Requests Requiring My Review</CardTitle>
                  <CardDescription>Cross-department requests pending your manager approval.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search requests..." 
                      className="pl-8" 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      data-testid="search-requests"
                    />
                  </div>
                  <Button 
                    variant={showFilters ? "secondary" : "outline"} 
                    size="icon"
                    onClick={() => setShowFilters(!showFilters)}
                    data-testid="toggle-filters"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FilterSection />
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : managerActionableRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                    <p className="text-lg font-medium">All caught up!</p>
                    <p className="text-sm">No requests pending your manager approval.</p>
                  </div>
                ) : (
                  <RequestsTable data={managerActionableRequests} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card className="shadow-md border-border/60">
              <CardHeader>
                <CardTitle>All Kaizen Requests</CardTitle>
                <CardDescription>Complete list of all requests in the system.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FilterSection />
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <RequestsTable data={allRequests} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (isHOD) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
              HOD Dashboard - {DEPARTMENT_DISPLAY_NAMES[currentUser?.department as DepartmentType]}
            </h2>
            <p className="text-muted-foreground mt-1">
              Review requests from your department and other departments.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card shadow-sm border-border/60 border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">My Dept Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{ownDeptRequests.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60 border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cross-HOD Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{crossDeptRequests.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {requests.filter((r: any) => r.status === 'APPROVED').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="own" className="space-y-4">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="own" className="gap-2" data-testid="tab-own-dept">
              <Building className="h-4 w-4" />
              My Dept ({ownDeptRequests.length})
            </TabsTrigger>
            <TabsTrigger value="cross" className="gap-2" data-testid="tab-cross-dept">
              <AlertCircle className="h-4 w-4" />
              Cross-HOD ({crossDeptRequests.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2" data-testid="tab-all-requests">
              <Eye className="h-4 w-4" />
              All ({allRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="own">
            <Card className="shadow-md border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Requests From My Department</CardTitle>
                  <CardDescription>These requests require your approval as the department HOD.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search requests..." 
                      className="pl-8" 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      data-testid="search-requests"
                    />
                  </div>
                  <Button 
                    variant={showFilters ? "secondary" : "outline"} 
                    size="icon"
                    onClick={() => setShowFilters(!showFilters)}
                    data-testid="toggle-filters"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FilterSection />
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : ownDeptRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                    <p className="text-lg font-medium">All caught up!</p>
                    <p className="text-sm">No requests from your department pending approval.</p>
                  </div>
                ) : (
                  <RequestsTable data={ownDeptRequests} showDept={false} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cross">
            <Card className="shadow-md border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Requests From Other Departments</CardTitle>
                  <CardDescription>Cross-department review required. All HODs must approve before escalation.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FilterSection />
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : crossDeptRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                    <p className="text-lg font-medium">No cross-department reviews pending!</p>
                  </div>
                ) : (
                  <RequestsTable data={crossDeptRequests} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card className="shadow-md border-border/60">
              <CardHeader>
                <CardTitle>All Kaizen Requests</CardTitle>
                <CardDescription>Complete list of all requests in the system.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FilterSection />
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <RequestsTable data={allRequests} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (isAGMorGM) {
    const actionableRequests = isAGM ? agmActionableRequests : gmActionableRequests;
    
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
              {currentUser?.role} Dashboard
            </h2>
            <p className="text-muted-foreground mt-1">
              View all Kaizen requests and take action on those routed to you.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-card shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60 border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Your Action</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{actionableRequests.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {requests.filter((r: any) => r.status.includes('PENDING')).length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {requests.filter((r: any) => r.status === 'APPROVED').length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {requests.filter((r: any) => r.status.includes('REJECTED')).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="action" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="action" className="gap-2" data-testid="tab-action-required">
              <AlertCircle className="h-4 w-4" />
              Requires My Action ({actionableRequests.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2" data-testid="tab-all-requests">
              <Eye className="h-4 w-4" />
              All Requests ({allRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="action">
            <Card className="shadow-md border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Requests Requiring My Action</CardTitle>
                  <CardDescription>These requests are currently routed to you for approval or rejection.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search requests..." 
                      className="pl-8" 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      data-testid="search-requests"
                    />
                  </div>
                  <Button 
                    variant={showFilters ? "secondary" : "outline"} 
                    size="icon"
                    onClick={() => setShowFilters(!showFilters)}
                    data-testid="toggle-filters"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FilterSection />
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : actionableRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                    <p className="text-lg font-medium">All caught up!</p>
                    <p className="text-sm">No requests currently require your action.</p>
                  </div>
                ) : (
                  <RequestsTable data={actionableRequests} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card className="shadow-md border-border/60">
              <CardHeader>
                <CardTitle>All Kaizen Requests</CardTitle>
                <CardDescription>Complete visibility of all requests across the organization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FilterSection />
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <RequestsTable data={allRequests} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
            {isInitiator ? 'My Requests' : 'Dashboard'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isInitiator ? 'Track your Kaizen requests and their status.' : 'View all Kaizen requests.'}
          </p>
        </div>
        {isInitiator && (
          <Link href="/create">
            <Button size="lg" className="shadow-lg shadow-primary/20" data-testid="btn-new-request">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isInitiator ? 'My Requests' : 'Total Requests'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isInitiator ? initiatorRequests.length : requests.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {(isInitiator ? initiatorRequests : requests).filter((r: any) => r.status.includes('PENDING')).length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {(isInitiator ? initiatorRequests : requests).filter((r: any) => r.status === 'APPROVED').length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(isInitiator ? initiatorRequests : requests).filter((r: any) => r.status.includes('REJECTED')).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{isInitiator ? 'My Kaizen Requests' : 'All Kaizen Requests'}</CardTitle>
            <CardDescription>
              {isInitiator ? 'Track the status of your submitted requests.' : 'View all requests in the system.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search requests..." 
                className="pl-8" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="search-requests"
              />
            </div>
            <Button 
              variant={showFilters ? "secondary" : "outline"} 
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="toggle-filters"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterSection />
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              Failed to load requests. Please try again.
            </div>
          ) : (
            <RequestsTable data={isInitiator ? initiatorRequests : allRequests} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
