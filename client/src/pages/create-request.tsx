import { useAuth } from "@/lib/store";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { ChevronLeft, Save, Upload, FileText, X } from "lucide-react";
import { DepartmentType, DEPARTMENTS, DEPARTMENT_DISPLAY_NAMES } from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { EXPECTED_BENEFITS, EFFECT_OF_CHANGES } from "@shared/schema";

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  stationName: z.string().min(2, "Station Name is required"),
  assemblyLine: z.string().optional(),
  issueDescription: z.string().min(10, "Description must be detailed"),
  pokaYokeDescription: z.string().optional(),
  reasonForImplementation: z.string().optional(),
  program: z.string().min(1, "Program is required"),
  customerPartNumber: z.string().min(1, "Part Number is required"),
  dateOfOrigination: z.string().min(1, "Date is required"),
  department: z.string(),
  feasibilityStatus: z.enum(["FEASIBLE", "NOT_FEASIBLE"]).optional(),
  feasibilityReason: z.string().optional(),
  expectedBenefits: z.array(z.string()).default([]),
  effectOfChanges: z.array(z.string()).default([]),
  costEstimate: z.coerce.number().min(0, "Cost must be a positive number"),
  costJustification: z.string().optional(),
  spareCostIncluded: z.boolean().default(false),
  requiresProcessAddition: z.boolean().default(false),
  requiresManpowerAddition: z.boolean().default(false),
});

type AttachmentFile = {
  file: File;
  category: 'PFMEA' | 'CHECK_SHEET' | 'CRR' | 'PHOTOS' | 'OTHER';
};

export default function CreateRequestPage() {
  const { currentUser } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<AttachmentFile['category']>('OTHER');

  const createMutation = useMutation({
    mutationFn: requestsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast({ title: "Request Created", description: "Kaizen request submitted and sent to your Department HOD." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      stationName: "",
      assemblyLine: "",
      issueDescription: "",
      pokaYokeDescription: "",
      reasonForImplementation: "",
      program: "",
      customerPartNumber: "",
      dateOfOrigination: new Date().toISOString().split('T')[0],
      department: currentUser?.department || "MAINTENANCE",
      feasibilityStatus: "FEASIBLE",
      feasibilityReason: "",
      expectedBenefits: [],
      effectOfChanges: [],
      costEstimate: 0,
      costJustification: "",
      spareCostIncluded: false,
      requiresProcessAddition: false,
      requiresManpowerAddition: false,
    },
  });

  const costEstimate = form.watch("costEstimate");
  const feasibilityStatus = form.watch("feasibilityStatus");

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate({
      ...values,
      department: values.department as DepartmentType,
      initiatorId: currentUser?.id || "unknown",
    });
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments = Array.from(files).map(file => ({
        file,
        category: selectedCategory
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-display font-bold">New Kaizen Request</h2>
          <p className="text-muted-foreground text-sm">Initiate a new risk assessment workflow based on PY Feasibility & Risk Assessment form.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="details" data-testid="tab-details">Issue Details</TabsTrigger>
              <TabsTrigger value="cost" data-testid="tab-cost">Cost & Impact</TabsTrigger>
              <TabsTrigger value="attachments" data-testid="tab-attachments">Attachments</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Header Information</CardTitle>
                  <CardDescription>Basic request identification details.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Request Title / Summary *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Conveyor Belt Speed Optimization" {...field} data-testid="input-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="program"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer / Program *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Model X Gen 2" {...field} data-testid="input-program" />
                        </FormControl>
                        <FormDescription>Map from PDF "Customer/Program"</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerPartNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Part Number & Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. MX-992-001" {...field} data-testid="input-part-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateOfOrigination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Origination *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-department">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DEPARTMENTS.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {DEPARTMENT_DISPLAY_NAMES[dept]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="feasibilityStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Feasibility for Implementation</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-feasibility">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="FEASIBLE">Feasible</SelectItem>
                            <SelectItem value="NOT_FEASIBLE">Not Feasible</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {feasibilityStatus === "NOT_FEASIBLE" && (
                    <FormField
                      control={form.control}
                      name="feasibilityReason"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Reason if Not Feasible *</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Explain why implementation is not feasible..." 
                              {...field} 
                              data-testid="input-feasibility-reason"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Main Issue Block</CardTitle>
                  <CardDescription>Detailed description of the issue and proposed improvement (mapped from PDF page 1).</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="stationName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Station Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Assembly Line A-12" {...field} data-testid="input-station" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assemblyLine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assembly Line / OP# & Station</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. OP-15, Station 3" {...field} data-testid="input-assembly-line" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="issueDescription"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Issue Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the current issue and why this kaizen is needed..." 
                            className="min-h-[120px]"
                            {...field} 
                            data-testid="input-issue-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pokaYokeDescription"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Poka-Yoke / Kaizen Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the proposed poka-yoke or kaizen solution..." 
                            className="min-h-[100px]"
                            {...field} 
                            data-testid="input-poka-yoke"
                          />
                        </FormControl>
                        <FormDescription>Detailed description of the error-proofing or improvement solution.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reasonForImplementation"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Reason for Implementation</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Why should this change be implemented? What problem does it solve?" 
                            className="min-h-[100px]"
                            {...field} 
                            data-testid="input-reason"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expectedBenefits"
                    render={() => (
                      <FormItem className="col-span-2">
                        <FormLabel>Expected Benefits</FormLabel>
                        <FormDescription>Select all benefits expected from this change.</FormDescription>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mt-2">
                          {EXPECTED_BENEFITS.map((benefit) => (
                            <FormField
                              key={benefit}
                              control={form.control}
                              name="expectedBenefits"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(benefit)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        if (checked) {
                                          field.onChange([...current, benefit]);
                                        } else {
                                          field.onChange(current.filter((v: string) => v !== benefit));
                                        }
                                      }}
                                      data-testid={`checkbox-benefit-${benefit.toLowerCase()}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">
                                    {benefit}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="effectOfChanges"
                    render={() => (
                      <FormItem className="col-span-2">
                        <FormLabel>Effect of Changes</FormLabel>
                        <FormDescription>Select areas affected by this change.</FormDescription>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-4 mt-2">
                          {EFFECT_OF_CHANGES.map((effect) => (
                            <FormField
                              key={effect}
                              control={form.control}
                              name="effectOfChanges"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(effect)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        if (checked) {
                                          field.onChange([...current, effect]);
                                        } else {
                                          field.onChange(current.filter((v: string) => v !== effect));
                                        }
                                      }}
                                      data-testid={`checkbox-effect-${effect.toLowerCase()}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">
                                    {effect}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cost" className="space-y-4 mt-4">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Cost & Escalation Flags</CardTitle>
                  <CardDescription>Estimate costs and resource requirements. Cost thresholds determine approval routing.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="costEstimate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost Estimate (₹) *</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-cost" />
                          </FormControl>
                          <FormDescription>
                            Estimated cost in INR. Thresholds: ≤₹50k (HOD), ₹50k-₹100k (AGM), &gt;₹100k (GM)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="spareCostIncluded"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-spare-cost"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Spare Cost Included?</FormLabel>
                            <FormDescription>Check if spare parts cost is included in estimate.</FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {costEstimate > 0 && (
                    <FormField
                      control={form.control}
                      name="costJustification"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost Justification {costEstimate > 50000 ? "*" : ""}</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Justify the cost estimate and expected ROI..." 
                              className="min-h-[100px]"
                              {...field} 
                              data-testid="input-cost-justification"
                            />
                          </FormControl>
                          <FormDescription>
                            {costEstimate > 50000 
                              ? "Required for escalated approvals (cost > ₹50,000)." 
                              : "Recommended for better approval chances."}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <FormField
                      control={form.control}
                      name="requiresProcessAddition"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 flex-1">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-process"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Requires Process Addition?</FormLabel>
                            <FormDescription>
                              New process steps may trigger escalation per settings.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="requiresManpowerAddition"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 flex-1">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-manpower"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Requires Manpower Addition?</FormLabel>
                            <FormDescription>
                              Additional staff may trigger escalation per settings.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {costEstimate > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <h4 className="font-semibold text-sm mb-2">Expected Approval Route</h4>
                      <p className="text-sm text-muted-foreground" data-testid="text-approval-route">
                        Own Dept HOD → All Other HODs → AGM → GM (Final Approval)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attachments" className="space-y-4 mt-4">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Attachments</CardTitle>
                  <CardDescription>
                    Upload supporting documents. Categories: PFMEA, Check Sheet, CRR, Photos, Other.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as AttachmentFile['category'])}>
                      <SelectTrigger className="w-[200px]" data-testid="select-attachment-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PFMEA">PFMEA</SelectItem>
                        <SelectItem value="CHECK_SHEET">Check Sheet</SelectItem>
                        <SelectItem value="CRR">CRR</SelectItem>
                        <SelectItem value="PHOTOS">Photos</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      multiple
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Select Files
                    </Button>
                  </div>

                  {attachments.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {attachments.map((att, index) => (
                        <div key={index} className="flex items-center justify-between p-3" data-testid={`attachment-item-${index}`}>
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{att.file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {att.category} • {(att.file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeAttachment(index)}
                            data-testid={`button-remove-attachment-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {attachments.length === 0 && (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No attachments added yet.</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-900">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> Refer to scanned form (PDF page 1-2) for QC checklist reference.
                      Required documents may be enforced based on system settings.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setLocation("/")} disabled={createMutation.isPending} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" size="lg" className="px-8" disabled={createMutation.isPending} data-testid="button-submit">
              <Save className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
