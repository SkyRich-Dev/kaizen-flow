import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, FunnelChart, Funnel, LabelList } from 'recharts';
import { Download, FileText, Calendar, TrendingUp, AlertTriangle, Users, DollarSign, Clock, FileCheck, Activity, Loader2, ChevronRight, BarChart3, PieChartIcon } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, departmentsApi } from "@/lib/api";
import { useAuth } from "@/lib/store";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const REPORT_CATEGORIES = {
  'my-requests': { title: 'My Kaizen Requests', icon: FileText, roles: ['INITIATOR', 'MANAGER', 'HOD', 'AGM', 'GM', 'ADMIN'] },
  'department-summary': { title: 'Department Summary', icon: BarChart3, roles: ['MANAGER', 'HOD', 'AGM', 'GM', 'ADMIN'] },
  'evaluation-details': { title: 'Evaluation Details', icon: FileCheck, roles: ['MANAGER', 'HOD', 'AGM', 'GM', 'ADMIN'] },
  'risk-heatmap': { title: 'Risk Heatmap', icon: AlertTriangle, roles: ['HOD', 'AGM', 'GM', 'ADMIN'] },
  'cross-dept-status': { title: 'Cross-Dept Status', icon: Users, roles: ['MANAGER', 'HOD', 'AGM', 'GM', 'ADMIN'] },
  'rejection-analysis': { title: 'Rejection Analysis', icon: AlertTriangle, roles: ['HOD', 'AGM', 'GM', 'ADMIN'] },
  'pipeline': { title: 'Pipeline / Funnel', icon: TrendingUp, roles: ['AGM', 'GM', 'ADMIN'] },
  'cost-impact': { title: 'Cost Impact', icon: DollarSign, roles: ['AGM', 'GM', 'ADMIN'] },
  'budget': { title: 'Budget Utilization', icon: DollarSign, roles: ['AGM', 'GM', 'ADMIN'] },
  'manpower-process': { title: 'Manpower & Process', icon: Users, roles: ['AGM', 'GM', 'ADMIN'] },
  'high-risk': { title: 'High Risk Kaizens', icon: AlertTriangle, roles: ['HOD', 'AGM', 'GM', 'ADMIN'] },
  'compliance': { title: 'Compliance & Docs', icon: FileCheck, roles: ['AGM', 'GM', 'ADMIN'] },
  'audit-trail': { title: 'Audit Trail', icon: Activity, roles: ['AGM', 'GM', 'ADMIN'] },
  'sla-delay': { title: 'SLA & Delays', icon: Clock, roles: ['HOD', 'AGM', 'GM', 'ADMIN'] },
  'tat': { title: 'Turnaround Time', icon: Clock, roles: ['AGM', 'GM', 'ADMIN'] },
  'notifications': { title: 'Notification Logs', icon: Activity, roles: ['ADMIN'] },
  'user-activity': { title: 'User Activity', icon: Users, roles: ['ADMIN'] },
};

type ReportType = keyof typeof REPORT_CATEGORIES;

export default function ReportsDashboard() {
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportType>('my-requests');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.getAll,
  });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['reportDashboard'],
    queryFn: reportsApi.getDashboard,
  });

  const availableReports = Object.entries(REPORT_CATEGORIES)
    .filter(([_, config]) => config.roles.includes(user?.role || ''))
    .map(([key, config]) => ({ key: key as ReportType, ...config }));

  const getFilterParams = () => {
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (selectedDepartment && selectedDepartment !== 'all') params.department = selectedDepartment;
    if (selectedStatus && selectedStatus !== 'all') params.status = selectedStatus;
    return params;
  };

  const handleExport = () => {
    reportsApi.exportCsv(selectedReport, getFilterParams());
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6">
      <Card className="w-72 h-full flex flex-col border-r shadow-none rounded-none border-y-0 border-l-0 shrink-0">
        <CardHeader className="px-4 py-6">
          <CardTitle className="text-lg">Reports Center</CardTitle>
          <CardDescription>Analytics & Insights</CardDescription>
        </CardHeader>
        <div className="flex-1 px-2 space-y-1 overflow-y-auto">
          {availableReports.map((report) => {
            const Icon = report.icon;
            return (
              <Button
                key={report.key}
                variant={selectedReport === report.key ? "secondary" : "ghost"}
                className="w-full justify-start text-sm"
                onClick={() => setSelectedReport(report.key)}
                data-testid={`report-nav-${report.key}`}
              >
                <Icon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{report.title}</span>
              </Button>
            );
          })}
        </div>
        <div className="p-4 border-t space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-muted rounded">
              <div className="text-2xl font-bold text-primary">{dashboard?.summary?.total || 0}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="p-2 bg-muted rounded">
              <div className="text-2xl font-bold text-green-600">{dashboard?.summary?.approved || 0}</div>
              <div className="text-xs text-muted-foreground">Approved</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex-1 overflow-y-auto pr-4 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-display font-bold">
              {REPORT_CATEGORIES[selectedReport]?.title || 'Report'}
            </h2>
            <p className="text-muted-foreground">Real-time analytics based on your access level.</p>
          </div>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
              data-testid="filter-date-from"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
              data-testid="filter-date-to"
            />
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-36" data-testid="filter-department">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} data-testid="button-export">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <ReportContent 
          reportType={selectedReport} 
          filters={getFilterParams()} 
        />
      </div>
    </div>
  );
}

function ReportContent({ reportType, filters }: { reportType: ReportType; filters: Record<string, string> }) {
  switch (reportType) {
    case 'my-requests':
      return <MyRequestsReport filters={filters} />;
    case 'department-summary':
      return <DepartmentSummaryReport filters={filters} />;
    case 'pipeline':
      return <PipelineReport filters={filters} />;
    case 'cost-impact':
      return <CostImpactReport filters={filters} />;
    case 'budget':
      return <BudgetReport filters={filters} />;
    case 'sla-delay':
      return <SlaDelayReport filters={filters} />;
    case 'tat':
      return <TatReport filters={filters} />;
    case 'high-risk':
      return <HighRiskReport filters={filters} />;
    case 'compliance':
      return <ComplianceReport filters={filters} />;
    case 'risk-heatmap':
      return <RiskHeatmapReport filters={filters} />;
    case 'cross-dept-status':
      return <CrossDeptStatusReport filters={filters} />;
    case 'rejection-analysis':
      return <RejectionAnalysisReport filters={filters} />;
    case 'audit-trail':
      return <AuditTrailReport filters={filters} />;
    case 'user-activity':
      return <UserActivityReport filters={filters} />;
    default:
      return <div className="text-center p-8 text-muted-foreground">Select a report from the sidebar</div>;
  }
}

function MyRequestsReport({ filters }: { filters: Record<string, string> }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['myRequests', filters],
    queryFn: () => reportsApi.getMyRequests(filters),
  });

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Kaizen Requests</CardTitle>
        <CardDescription>Track all your submitted requests and their status.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kaizen ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pending With</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id} data-testid={`row-request-${row.id}`}>
                <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.department}</TableCell>
                <TableCell><StatusBadge status={row.current_status} /></TableCell>
                <TableCell>{row.pending_with}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(row.submission_date).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No requests found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DepartmentSummaryReport({ filters }: { filters: Record<string, string> }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['departmentSummary', filters],
    queryFn: () => reportsApi.getDepartmentSummary(filters),
  });

  if (isLoading) return <LoadingState />;

  const byDept = data.reduce((acc: any, r: any) => {
    acc[r.department] = (acc[r.department] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(byDept).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Requests by Department</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Total Requests" value={data.length} color="blue" />
              <StatCard label="Avg Days in Workflow" value={Math.round(data.reduce((s: number, r: any) => s + r.days_in_workflow, 0) / (data.length || 1))} color="amber" />
              <StatCard label="High Risk" value={data.filter((r: any) => r.risk_level === 'HIGH').length} color="red" />
              <StatCard label="Low Risk" value={data.filter((r: any) => r.risk_level === 'LOW').length} color="green" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kaizen ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 20).map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell>₹{row.cost_estimate.toLocaleString()}</TableCell>
                  <TableCell><RiskBadge risk={row.risk_level} /></TableCell>
                  <TableCell>{row.days_in_workflow}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PipelineReport({ filters }: { filters: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['pipeline', filters],
    queryFn: () => reportsApi.getPipeline(filters),
  });

  if (isLoading) return <LoadingState />;

  const funnelData = data?.funnel?.filter((s: any) => s.count > 0) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Kaizens" value={data?.total || 0} color="blue" />
        <StatCard label="Pending" value={data?.pending || 0} color="amber" />
        <StatCard label="Approved" value={data?.approved || 0} color="green" />
        <StatCard label="Rejected" value={data?.rejected || 0} color="red" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Pipeline</CardTitle>
          <CardDescription>Distribution of requests across workflow stages</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="stage" type="category" width={120} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function CostImpactReport({ filters }: { filters: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['costImpact', filters],
    queryFn: () => reportsApi.getCostImpact(filters),
  });

  if (isLoading) return <LoadingState />;

  const levelData = [
    { name: 'HOD Level', count: data?.summary?.by_level?.hod || 0 },
    { name: 'AGM Level', count: data?.summary?.by_level?.agm || 0 },
    { name: 'GM Level', count: data?.summary?.by_level?.gm || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Cost" value={`₹${((data?.summary?.total_cost || 0) / 100000).toFixed(1)}L`} color="blue" />
        <StatCard label="Approved Cost" value={`₹${((data?.summary?.approved_cost || 0) / 100000).toFixed(1)}L`} color="green" />
        <StatCard label="Pending Cost" value={`₹${((data?.summary?.pending_cost || 0) / 100000).toFixed(1)}L`} color="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Requests by Approval Level</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kaizen ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.requests || []).slice(0, 10).map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell>₹{row.cost_estimate.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{row.approval_level_required}</Badge></TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BudgetReport({ filters }: { filters: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['budget', filters],
    queryFn: () => reportsApi.getBudget(filters),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="Total Approved Cost" value={`₹${((data?.total_approved_cost || 0) / 100000).toFixed(1)}L`} color="green" />
        <StatCard label="Total Approved Count" value={data?.total_approved_count || 0} color="blue" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Spend Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthly_spend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Department</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.by_department || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="department__name" type="category" width={100} fontSize={12} />
                <Tooltip />
                <Bar dataKey="total_cost" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SlaDelayReport({ filters }: { filters: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['slaDelay', filters],
    queryFn: () => reportsApi.getSlaDelay(filters),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Pending" value={data?.summary?.total_pending || 0} color="blue" />
        <StatCard label="Delayed" value={data?.summary?.delayed || 0} color="red" />
        <StatCard label="On Track" value={data?.summary?.on_track || 0} color="green" />
        <StatCard label="Avg Delay (hrs)" value={data?.summary?.avg_delay_hours || 0} color="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SLA Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kaizen ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>SLA Target (hrs)</TableHead>
                <TableHead>Actual (hrs)</TableHead>
                <TableHead>Delay (hrs)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.requests || []).map((row: any) => (
                <TableRow key={row.id} className={row.is_delayed ? 'bg-red-50' : ''}>
                  <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.current_stage}</TableCell>
                  <TableCell>{row.sla_target_hours}</TableCell>
                  <TableCell>{row.actual_hours}</TableCell>
                  <TableCell className={row.delay_hours > 0 ? 'text-red-600 font-semibold' : ''}>{row.delay_hours}</TableCell>
                  <TableCell>
                    <Badge variant={row.is_delayed ? 'destructive' : 'default'}>
                      {row.is_delayed ? 'Delayed' : 'On Track'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TatReport({ filters }: { filters: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tat', filters],
    queryFn: () => reportsApi.getTat(filters),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Avg TAT (hrs)" value={data?.summary?.avg_hours || 0} color="blue" />
        <StatCard label="Avg TAT (days)" value={data?.summary?.avg_days || 0} color="blue" />
        <StatCard label="Fastest (hrs)" value={data?.summary?.min_hours || 0} color="green" />
        <StatCard label="Slowest (hrs)" value={data?.summary?.max_hours || 0} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fastest Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kaizen ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.fastest || []).map((row: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell>{row.total_hours}</TableCell>
                    <TableCell>{row.total_days}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slowest Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kaizen ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.slowest || []).map((row: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell>{row.total_hours}</TableCell>
                    <TableCell>{row.total_days}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HighRiskReport({ filters }: { filters: Record<string, string> }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['highRisk', filters],
    queryFn: () => reportsApi.getHighRisk(filters),
  });

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          High Risk Kaizens
        </CardTitle>
        <CardDescription>Requests flagged with high risk evaluations or rejected due to risk.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kaizen ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>High Risk Depts</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rejection Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id} className="bg-red-50/50">
                <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.department}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {row.high_risk_departments?.map((d: string, i: number) => (
                      <Badge key={i} variant="destructive" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
                <TableCell className="max-w-[200px] truncate">{row.rejection_reason || '-'}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No high risk kaizens found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ComplianceReport({ filters }: { filters: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance', filters],
    queryFn: () => reportsApi.getCompliance(filters),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Requests" value={data?.summary?.total || 0} color="blue" />
        <StatCard label="Complete Docs" value={data?.summary?.complete || 0} color="green" />
        <StatCard label="Incomplete Docs" value={data?.summary?.incomplete || 0} color="red" />
        <StatCard label="Missing PFMEA" value={data?.summary?.missing_pfmea || 0} color="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentation Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kaizen ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>PFMEA</TableHead>
                <TableHead>CRR</TableHead>
                <TableHead>Checksheet</TableHead>
                <TableHead>Missing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.requests || []).filter((r: any) => r.missing_docs?.length > 0).slice(0, 20).map((row: any) => (
                <TableRow key={row.id} className={row.missing_docs?.length > 0 ? 'bg-amber-50/50' : ''}>
                  <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.has_pfmea ? '✓' : '✗'}</TableCell>
                  <TableCell>{row.has_crr ? '✓' : '✗'}</TableCell>
                  <TableCell>{row.has_checksheet ? '✓' : '✗'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.missing_docs?.map((d: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskHeatmapReport({ filters }: { filters: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['riskHeatmap', filters],
    queryFn: () => reportsApi.getRiskHeatmap(filters),
  });

  if (isLoading) return <LoadingState />;

  const deptRisk = Object.entries(data?.department_risk || {}).map(([name, counts]: [string, any]) => ({
    name,
    HIGH: counts.HIGH || 0,
    MEDIUM: counts.MEDIUM || 0,
    LOW: counts.LOW || 0,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Risk by Department</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptRisk}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="HIGH" fill="#ef4444" stackId="a" />
              <Bar dataKey="MEDIUM" fill="#f59e0b" stackId="a" />
              <Bar dataKey="LOW" fill="#10b981" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>High Risk Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question ID</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>High Count</TableHead>
                <TableHead>Medium Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.high_risk_questions || []).map((row: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-sm">{row.id}</TableCell>
                  <TableCell>{row.text?.substring(0, 60) || 'N/A'}</TableCell>
                  <TableCell className="text-red-600 font-semibold">{row.high_count}</TableCell>
                  <TableCell className="text-amber-600">{row.medium_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CrossDeptStatusReport({ filters }: { filters: Record<string, string> }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['crossDeptStatus', filters],
    queryFn: () => reportsApi.getCrossDeptStatus(filters),
  });

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cross-Department Approval Status</CardTitle>
        <CardDescription>Track approval progress across all departments.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kaizen ID</TableHead>
              <TableHead>Initiator Dept</TableHead>
              <TableHead>Pending Managers</TableHead>
              <TableHead>Pending HODs</TableHead>
              <TableHead>Mgr %</TableHead>
              <TableHead>HOD %</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                <TableCell>{row.initiator_department}</TableCell>
                <TableCell className="max-w-[150px]">
                  <div className="flex flex-wrap gap-1">
                    {row.pending_manager_depts?.slice(0, 3).map((d: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="max-w-[150px]">
                  <div className="flex flex-wrap gap-1">
                    {row.pending_hod_depts?.slice(0, 3).map((d: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{row.manager_completion}%</TableCell>
                <TableCell>{row.hod_completion}%</TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RejectionAnalysisReport({ filters }: { filters: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['rejectionAnalysis', filters],
    queryFn: () => reportsApi.getRejectionAnalysis(filters),
  });

  if (isLoading) return <LoadingState />;

  const byRole = Object.entries(data?.summary?.by_role || {}).map(([name, count]) => ({ name, count }));
  const byDept = Object.entries(data?.summary?.by_department || {}).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Rejections by Role</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRole}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rejections by Department</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rejection Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kaizen ID</TableHead>
                <TableHead>Rejected By</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rejections || []).slice(0, 20).map((row: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-sm">{row.request_id}</TableCell>
                  <TableCell>{row.rejected_by_name}</TableCell>
                  <TableCell>{row.rejected_by_role}</TableCell>
                  <TableCell>{row.rejected_department}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{row.rejection_reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AuditTrailReport({ filters }: { filters: Record<string, string> }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['auditTrail', filters],
    queryFn: () => reportsApi.getAuditTrail(filters),
  });

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
        <CardDescription>Complete action history for compliance.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Kaizen ID</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="text-sm text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-sm">{row.kaizen_id || '-'}</TableCell>
                <TableCell><Badge variant="outline">{row.action}</Badge></TableCell>
                <TableCell>{row.user}</TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell>{row.department}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UserActivityReport({ filters }: { filters: Record<string, string> }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['userActivity', filters],
    queryFn: () => reportsApi.getUserActivity(filters),
  });

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Activity</CardTitle>
        <CardDescription>User actions and approval statistics.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead>Approvals</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.username}</TableCell>
                <TableCell>{row.full_name}</TableCell>
                <TableCell><Badge variant="outline">{row.role}</Badge></TableCell>
                <TableCell>{row.department}</TableCell>
                <TableCell>{row.actions_count}</TableCell>
                <TableCell>{row.approval_count}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.last_login !== 'Never' ? new Date(row.last_login).toLocaleDateString() : 'Never'}</TableCell>
                <TableCell>{row.is_active ? '✓' : '✗'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: 'blue' | 'green' | 'red' | 'amber' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    green: 'bg-green-50 border-green-100 text-green-800',
    red: 'bg-red-50 border-red-100 text-red-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
  };

  return (
    <Card className={colors[color]}>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs opacity-80">{label}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    DRAFT: 'outline',
    APPROVED: 'default',
    REJECTED: 'destructive',
  };

  return (
    <Badge variant={variants[status] || 'secondary'} className="text-xs">
      {status?.replace(/_/g, ' ')}
    </Badge>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = {
    HIGH: 'bg-red-100 text-red-800',
    MEDIUM: 'bg-amber-100 text-amber-800',
    LOW: 'bg-green-100 text-green-800',
  };

  return (
    <Badge className={colors[risk] || 'bg-gray-100 text-gray-800'}>
      {risk}
    </Badge>
  );
}
