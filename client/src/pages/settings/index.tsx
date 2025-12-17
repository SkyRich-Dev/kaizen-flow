import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { User, Shield, Bell, Settings as SettingsIcon, Database, Lock, Users, Loader2, Mail, MessageSquare, CheckCircle2, XCircle, AlertTriangle, Send } from "lucide-react";
import { Role } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi, usersApi, notificationSettingsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState("users");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  });

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: "Settings Updated", description: "System configuration has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: "User Created", description: "New user account has been created." });
      setNewUser({ username: '', first_name: '', last_name: '', email: '', role: 'INITIATOR', department: 'MAINTENANCE', password: '' });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: "User Updated", description: "User has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  // Local state for forms
  const [newUser, setNewUser] = useState({ username: '', first_name: '', last_name: '', email: '', role: 'INITIATOR', department: 'MAINTENANCE', password: '' });

  // Default settings for handling empty API responses
  const defaultSettings = {
    costThresholds: { hodLimit: 50000, agmLimit: 100000 },
    sla: { ownHodReviewHours: 24, crossHodReviewHours: 48, agmReviewHours: 48, gmReviewHours: 72 },
    notifications: { emailEnabled: false, notifyOnSubmission: true, notifyOnEscalation: true, notifyOnApproval: true, notifyOnRejection: true }
  };

  const mergedSettings = settings ? { 
    ...defaultSettings, 
    ...settings, 
    costThresholds: { ...defaultSettings.costThresholds, ...(settings.costThresholds || {}) }, 
    sla: { ...defaultSettings.sla, ...(settings.sla || {}) }, 
    notifications: { ...defaultSettings.notifications, ...(settings.notifications || {}) } 
  } : defaultSettings;

  const handleCreateUser = () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast({ title: "Error", description: "Please fill in username, email, and password", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({
      username: newUser.username,
      email: newUser.email,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      role: newUser.role as Role,
      department: newUser.department as any,
      password: newUser.password,
    });
  };

  const handleUpdateSettings = (newSettings: any) => {
    updateSettingsMutation.mutate({ ...mergedSettings, ...newSettings });
  };

  if (settingsLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight">System Settings</h2>
          <p className="text-muted-foreground">Configure application rules, users, and workflows.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4"/> User Management</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2"><Shield className="h-4 w-4"/> Approval Config</TabsTrigger>
          <TabsTrigger value="workflow" className="gap-2"><SettingsIcon className="h-4 w-4"/> Workflow & SLA</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4"/> Notifications</TabsTrigger>
        </TabsList>

        {/* USER MANAGEMENT */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>Manage system access and roles.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                        <TableCell><span className="text-xs bg-secondary px-2 py-1 rounded">{user.role}</span></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{user.department_name || user.department}</TableCell>
                        <TableCell>
                          <Switch checked={user.is_active} onCheckedChange={(checked) => updateUserMutation.mutate({ id: user.id, data: { is_active: checked } })} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add User</CardTitle>
                <CardDescription>Create a new account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} placeholder="e.g., john.doe" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input value={newUser.first_name} onChange={(e) => setNewUser({...newUser, first_name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={newUser.last_name} onChange={(e) => setNewUser({...newUser, last_name: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Password (min 8 characters)</Label>
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} placeholder="Enter password" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INITIATOR">Initiator</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="HOD">HOD</SelectItem>
                      <SelectItem value="AGM">AGM</SelectItem>
                      <SelectItem value="GM">GM</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={newUser.department} onValueChange={(v) => setNewUser({...newUser, department: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="PRODUCTION">Production</SelectItem>
                      <SelectItem value="ASSEMBLY">Assembly</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="ACCOUNTS">Accounts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreateUser}>Create User</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* APPROVAL CONFIG */}
        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dynamic Cost Thresholds</CardTitle>
              <CardDescription>Configure the financial limits for approval escalation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-base">HOD Approval Limit (₹)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={mergedSettings.costThresholds.hodLimit}
                      onChange={(e) => handleUpdateSettings({ 
                        costThresholds: { ...mergedSettings.costThresholds, hodLimit: parseInt(e.target.value) } 
                      })}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Max for HOD only</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Requests below this amount (and without resource additions) are approved by HOD.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base">AGM Approval Limit (₹)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={mergedSettings.costThresholds.agmLimit}
                      onChange={(e) => handleUpdateSettings({ 
                        costThresholds: { ...mergedSettings.costThresholds, agmLimit: parseInt(e.target.value) } 
                      })}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Max for AGM</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Requests above this amount require GM approval.</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 border p-4 rounded-lg bg-muted/20">
                <Switch 
                  id="resource-mode" 
                  checked={mergedSettings.mandatoryAgmForResources ?? false}
                  onCheckedChange={(c) => handleUpdateSettings({ mandatoryAgmForResources: c })}
                />
                <div className="flex-1">
                  <Label htmlFor="resource-mode" className="text-base font-medium">Mandatory AGM Approval for Resource Additions</Label>
                  <p className="text-sm text-muted-foreground">
                    If enabled, any request requiring Process or Manpower addition will automatically escalate to AGM, regardless of cost.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* WORKFLOW & SLA */}
        <TabsContent value="workflow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Level Agreements (SLA)</CardTitle>
              <CardDescription>Set expected turnaround times for each stage (in hours).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>CFT Review</Label>
                  <Input 
                    type="number" 
                    value={mergedSettings.sla.cftReviewHours ?? 24}
                    onChange={(e) => handleUpdateSettings({ sla: { ...mergedSettings.sla, cftReviewHours: parseInt(e.target.value) } })} 
                  />
                  <span className="text-xs text-muted-foreground">Hours</span>
                </div>
                <div className="space-y-2">
                  <Label>HOD Review</Label>
                  <Input 
                    type="number" 
                    value={mergedSettings.sla.hodReviewHours ?? 24}
                    onChange={(e) => handleUpdateSettings({ sla: { ...mergedSettings.sla, hodReviewHours: parseInt(e.target.value) } })} 
                  />
                  <span className="text-xs text-muted-foreground">Hours</span>
                </div>
                <div className="space-y-2">
                  <Label>AGM Review</Label>
                  <Input 
                    type="number" 
                    value={mergedSettings.sla.agmReviewHours}
                    onChange={(e) => handleUpdateSettings({ sla: { ...mergedSettings.sla, agmReviewHours: parseInt(e.target.value) } })} 
                  />
                  <span className="text-xs text-muted-foreground">Hours</span>
                </div>
                <div className="space-y-2">
                  <Label>GM Review</Label>
                  <Input 
                    type="number" 
                    value={mergedSettings.sla.gmReviewHours}
                    onChange={(e) => handleUpdateSettings({ sla: { ...mergedSettings.sla, gmReviewHours: parseInt(e.target.value) } })} 
                  />
                  <span className="text-xs text-muted-foreground">Hours</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

         {/* NOTIFICATIONS */}
         <TabsContent value="notifications" className="space-y-4">
           <NotificationSettingsPanel />
         </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: notifSettings, isLoading } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: notificationSettingsApi.get,
  });

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailConfig, setEmailConfig] = useState({
    smtp_host: '',
    smtp_port: '587',
    sender_email: '',
    sender_name: 'KaizenFlow',
    username: '',
    password: '',
    use_tls: true,
  });
  
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappConfig, setWhatsappConfig] = useState({
    provider: 'twilio',
    api_url: '',
    account_sid: '',
    auth_token: '',
    sender_number: '',
    default_country_code: '+91',
  });
  
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    if (notifSettings) {
      setEmailEnabled(notifSettings.email.enabled);
      setEmailConfig(prev => ({ ...prev, ...notifSettings.email.config }));
      setWhatsappEnabled(notifSettings.whatsapp.enabled);
      setWhatsappConfig(prev => ({ ...prev, ...notifSettings.whatsapp.config }));
    }
  }, [notifSettings]);

  const saveEmailMutation = useMutation({
    mutationFn: notificationSettingsApi.saveEmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
      toast({ title: "Email Settings Saved", description: "Email notification configuration has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveWhatsAppMutation = useMutation({
    mutationFn: notificationSettingsApi.saveWhatsApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
      toast({ title: "WhatsApp Settings Saved", description: "WhatsApp notification configuration has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: notificationSettingsApi.testEmail,
    onSuccess: () => {
      toast({ title: "Test Email Sent", description: "Check your inbox for the test email." });
    },
    onError: (error: Error) => {
      toast({ title: "Test Failed", description: error.message, variant: "destructive" });
    },
  });

  const testWhatsAppMutation = useMutation({
    mutationFn: notificationSettingsApi.testWhatsApp,
    onSuccess: () => {
      toast({ title: "Test Message Sent", description: "Check your WhatsApp for the test message." });
    },
    onError: (error: Error) => {
      toast({ title: "Test Failed", description: error.message, variant: "destructive" });
    },
  });

  const getStatusIcon = (enabled: boolean, hasConfig: boolean) => {
    if (enabled && hasConfig) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (!enabled) return <XCircle className="h-5 w-5 text-gray-400" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusText = (enabled: boolean, hasConfig: boolean) => {
    if (enabled && hasConfig) return "Active";
    if (!enabled) return "Disabled";
    return "Misconfigured";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasEmailConfig = emailConfig.smtp_host && emailConfig.sender_email && emailConfig.username;
  const hasWhatsAppConfig = whatsappConfig.account_sid && whatsappConfig.sender_number;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* EMAIL NOTIFICATION CARD */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Email Notifications</CardTitle>
                <CardDescription>Configure SMTP settings for email alerts</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(emailEnabled, hasEmailConfig)}
              <span className="text-sm text-muted-foreground">{getStatusText(emailEnabled, hasEmailConfig)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <Label htmlFor="email-toggle" className="font-medium">Enable Email Notifications</Label>
            <Switch 
              id="email-toggle"
              checked={emailEnabled} 
              onCheckedChange={setEmailEnabled}
              data-testid="toggle-email-enabled"
            />
          </div>

          {emailEnabled && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input 
                    value={emailConfig.smtp_host}
                    onChange={(e) => setEmailConfig({...emailConfig, smtp_host: e.target.value})}
                    placeholder="smtp.gmail.com"
                    data-testid="input-smtp-host"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input 
                    value={emailConfig.smtp_port}
                    onChange={(e) => setEmailConfig({...emailConfig, smtp_port: e.target.value})}
                    placeholder="587"
                    data-testid="input-smtp-port"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sender Email</Label>
                  <Input 
                    type="email"
                    value={emailConfig.sender_email}
                    onChange={(e) => setEmailConfig({...emailConfig, sender_email: e.target.value})}
                    placeholder="notifications@company.com"
                    data-testid="input-sender-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sender Name</Label>
                  <Input 
                    value={emailConfig.sender_name}
                    onChange={(e) => setEmailConfig({...emailConfig, sender_name: e.target.value})}
                    placeholder="KaizenFlow"
                    data-testid="input-sender-name"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input 
                    value={emailConfig.username}
                    onChange={(e) => setEmailConfig({...emailConfig, username: e.target.value})}
                    placeholder="SMTP username"
                    data-testid="input-smtp-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password / App Password</Label>
                  <Input 
                    type="password"
                    value={emailConfig.password}
                    onChange={(e) => setEmailConfig({...emailConfig, password: e.target.value})}
                    placeholder="Enter password"
                    data-testid="input-smtp-password"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="use-tls"
                  checked={emailConfig.use_tls}
                  onCheckedChange={(c) => setEmailConfig({...emailConfig, use_tls: c as boolean})}
                  data-testid="checkbox-use-tls"
                />
                <Label htmlFor="use-tls" className="font-normal">Use TLS encryption</Label>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => saveEmailMutation.mutate({ enabled: emailEnabled, config: emailConfig })}
                  disabled={saveEmailMutation.isPending}
                  data-testid="button-save-email"
                >
                  {saveEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Settings
                </Button>
                <div className="flex-1" />
                <Input 
                  type="email"
                  placeholder="Test email address"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-48"
                  data-testid="input-test-email"
                />
                <Button 
                  variant="outline"
                  onClick={() => testEmailMutation.mutate(testEmail)}
                  disabled={!testEmail || testEmailMutation.isPending}
                  data-testid="button-test-email"
                >
                  {testEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WHATSAPP NOTIFICATION CARD */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg">WhatsApp Notifications</CardTitle>
                <CardDescription>Configure WhatsApp API for instant messaging</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(whatsappEnabled, hasWhatsAppConfig)}
              <span className="text-sm text-muted-foreground">{getStatusText(whatsappEnabled, hasWhatsAppConfig)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <Label htmlFor="whatsapp-toggle" className="font-medium">Enable WhatsApp Notifications</Label>
            <Switch 
              id="whatsapp-toggle"
              checked={whatsappEnabled} 
              onCheckedChange={setWhatsappEnabled}
              data-testid="toggle-whatsapp-enabled"
            />
          </div>

          {whatsappEnabled && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>WhatsApp Provider</Label>
                  <Select 
                    value={whatsappConfig.provider} 
                    onValueChange={(v) => setWhatsappConfig({...whatsappConfig, provider: v})}
                  >
                    <SelectTrigger data-testid="select-whatsapp-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="meta">Meta Cloud API</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>API URL (optional)</Label>
                  <Input 
                    value={whatsappConfig.api_url}
                    onChange={(e) => setWhatsappConfig({...whatsappConfig, api_url: e.target.value})}
                    placeholder="Custom API endpoint"
                    data-testid="input-whatsapp-api-url"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account SID / Client ID</Label>
                  <Input 
                    value={whatsappConfig.account_sid}
                    onChange={(e) => setWhatsappConfig({...whatsappConfig, account_sid: e.target.value})}
                    placeholder="Your account SID"
                    data-testid="input-whatsapp-sid"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Auth Token / API Key</Label>
                  <Input 
                    type="password"
                    value={whatsappConfig.auth_token}
                    onChange={(e) => setWhatsappConfig({...whatsappConfig, auth_token: e.target.value})}
                    placeholder="Your auth token"
                    data-testid="input-whatsapp-token"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sender WhatsApp Number</Label>
                  <Input 
                    value={whatsappConfig.sender_number}
                    onChange={(e) => setWhatsappConfig({...whatsappConfig, sender_number: e.target.value})}
                    placeholder="+14155238886"
                    data-testid="input-whatsapp-sender"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Country Code</Label>
                  <Input 
                    value={whatsappConfig.default_country_code}
                    onChange={(e) => setWhatsappConfig({...whatsappConfig, default_country_code: e.target.value})}
                    placeholder="+91"
                    data-testid="input-whatsapp-country"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => saveWhatsAppMutation.mutate({ enabled: whatsappEnabled, config: whatsappConfig })}
                  disabled={saveWhatsAppMutation.isPending}
                  data-testid="button-save-whatsapp"
                >
                  {saveWhatsAppMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Settings
                </Button>
                <div className="flex-1" />
                <Input 
                  placeholder="Test phone number"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-48"
                  data-testid="input-test-phone"
                />
                <Button 
                  variant="outline"
                  onClick={() => testWhatsAppMutation.mutate(testPhone)}
                  disabled={!testPhone || testWhatsAppMutation.isPending}
                  data-testid="button-test-whatsapp"
                >
                  {testWhatsAppMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
