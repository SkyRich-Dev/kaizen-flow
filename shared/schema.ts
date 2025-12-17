import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const DEPARTMENTS = ['MAINTENANCE', 'PRODUCTION', 'ASSEMBLY', 'ADMIN', 'ACCOUNTS'] as const;
export type DepartmentType = typeof DEPARTMENTS[number];

export const REQUEST_STATUSES = [
  'DRAFT',
  'PENDING_OWN_HOD',
  'OWN_HOD_REJECTED',
  'PENDING_CROSS_MANAGER',
  'MANAGER_REJECTED',
  'PENDING_CROSS_HOD',
  'CROSS_HOD_REJECTED',
  'PENDING_AGM',
  'AGM_REJECTED',
  'PENDING_GM',
  'APPROVED',
  'REJECTED'
] as const;
export type RequestStatusType = typeof REQUEST_STATUSES[number];

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique().$type<DepartmentType>(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().$type<'INITIATOR' | 'MANAGER' | 'HOD' | 'AGM' | 'GM' | 'ADMIN'>(),
  departmentId: integer("department_id").references(() => departments.id),
  department: text("department").$type<DepartmentType>(),
  isHod: boolean("is_hod").notNull().default(false),
  isManager: boolean("is_manager").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kaizenRequests = pgTable("kaizen_requests", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  title: text("title").notNull(),
  stationName: text("station_name").notNull(),
  assemblyLine: text("assembly_line"),
  issueDescription: text("issue_description").notNull(),
  pokaYokeDescription: text("poka_yoke_description"),
  reasonForImplementation: text("reason_for_implementation"),
  program: text("program").notNull(),
  customerPartNumber: text("customer_part_number").notNull(),
  dateOfOrigination: text("date_of_origination").notNull(),
  department: text("department").notNull().$type<DepartmentType>(),
  initiatorId: varchar("initiator_id").notNull().references(() => users.id),
  initiatorDepartmentId: integer("initiator_department_id").references(() => departments.id),
  feasibilityStatus: text("feasibility_status").$type<'FEASIBLE' | 'NOT_FEASIBLE'>(),
  feasibilityReason: text("feasibility_reason"),
  expectedBenefits: text("expected_benefits").array(),
  effectOfChanges: text("effect_of_changes").array(),
  costEstimate: integer("cost_estimate").notNull(),
  costCurrency: text("cost_currency").default('INR'),
  costJustification: text("cost_justification"),
  spareCostIncluded: boolean("spare_cost_included").default(false),
  requiresProcessAddition: boolean("requires_process_addition").notNull().default(false),
  requiresManpowerAddition: boolean("requires_manpower_addition").notNull().default(false),
  status: text("status").notNull().$type<RequestStatusType>(),
  currentStage: text("current_stage").$type<'OWN_HOD' | 'CROSS_MANAGER' | 'CROSS_HOD' | 'AGM' | 'GM' | 'COMPLETED'>(),
  rejectionReason: text("rejection_reason"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedByDepartment: text("rejected_by_department").$type<DepartmentType>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kaizenManagerApprovals = pgTable("kaizen_manager_approvals", {
  id: serial("id").primaryKey(),
  kaizenId: integer("kaizen_id").notNull().references(() => kaizenRequests.id),
  managerUserId: varchar("manager_user_id").notNull().references(() => users.id),
  departmentId: integer("department_id").references(() => departments.id),
  department: text("department").notNull().$type<DepartmentType>(),
  decision: text("decision").notNull().$type<'APPROVED' | 'REJECTED'>(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kaizenHodApprovals = pgTable("kaizen_hod_approvals", {
  id: serial("id").primaryKey(),
  kaizenId: integer("kaizen_id").notNull().references(() => kaizenRequests.id),
  hodUserId: varchar("hod_user_id").notNull().references(() => users.id),
  departmentId: integer("department_id").references(() => departments.id),
  department: text("department").notNull().$type<DepartmentType>(),
  decision: text("decision").notNull().$type<'APPROVED' | 'REJECTED'>(),
  remarks: text("remarks"),
  stageType: text("stage_type").notNull().$type<'OWN_HOD' | 'CROSS_HOD'>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => kaizenRequests.id),
  approvalType: text("approval_type").notNull().$type<'AGM' | 'GM'>(),
  approvedBy: varchar("approved_by").notNull().references(() => users.id),
  approved: boolean("approved").notNull(),
  comments: text("comments"),
  costJustification: text("cost_justification"),
  signerName: text("signer_name"),
  approvedAt: timestamp("approved_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").references(() => kaizenRequests.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  details: jsonb("details"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const kaizenAttachments = pgTable("kaizen_attachments", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => kaizenRequests.id),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  category: text("category").notNull().$type<'PFMEA' | 'CHECK_SHEET' | 'CRR' | 'PHOTOS' | 'OTHER'>(),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const kaizenVersions = pgTable("kaizen_versions", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => kaizenRequests.id),
  versionNumber: integer("version_number").notNull(),
  snapshotJson: jsonb("snapshot_json").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kaizenDepartmentEvaluations = pgTable("kaizen_department_evaluations", {
  id: serial("id").primaryKey(),
  kaizenId: integer("kaizen_id").notNull().references(() => kaizenRequests.id),
  department: text("department").notNull().$type<DepartmentType>(),
  evaluatorUserId: varchar("evaluator_user_id").notNull().references(() => users.id),
  evaluatorRole: text("evaluator_role").notNull().$type<'MANAGER' | 'HOD'>(),
  evaluationAnswers: jsonb("evaluation_answers").notNull().$type<EvaluationAnswer[]>(),
  decision: text("decision").notNull().$type<'APPROVED' | 'REJECTED'>(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true 
});

export const insertKaizenRequestSchema = createInsertSchema(kaizenRequests).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertManagerApprovalSchema = createInsertSchema(kaizenManagerApprovals).omit({ 
  id: true, 
  createdAt: true 
});

export const insertHodApprovalSchema = createInsertSchema(kaizenHodApprovals).omit({ 
  id: true, 
  createdAt: true 
});

export const insertApprovalSchema = createInsertSchema(approvals).omit({ 
  id: true, 
  approvedAt: true 
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ 
  id: true, 
  timestamp: true 
});

export const insertAttachmentSchema = createInsertSchema(kaizenAttachments).omit({
  id: true,
  uploadedAt: true
});

export const insertVersionSchema = createInsertSchema(kaizenVersions).omit({
  id: true,
  createdAt: true
});

export const insertDepartmentEvaluationSchema = createInsertSchema(kaizenDepartmentEvaluations).omit({
  id: true,
  createdAt: true
});

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertKaizenRequest = z.infer<typeof insertKaizenRequestSchema>;
export type KaizenRequest = typeof kaizenRequests.$inferSelect;

export type InsertManagerApproval = z.infer<typeof insertManagerApprovalSchema>;
export type ManagerApproval = typeof kaizenManagerApprovals.$inferSelect;

export type InsertHodApproval = z.infer<typeof insertHodApprovalSchema>;
export type HodApproval = typeof kaizenHodApprovals.$inferSelect;

export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvals.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof kaizenAttachments.$inferSelect;

export type InsertVersion = z.infer<typeof insertVersionSchema>;
export type Version = typeof kaizenVersions.$inferSelect;

export type InsertDepartmentEvaluation = z.infer<typeof insertDepartmentEvaluationSchema>;
export type DepartmentEvaluation = typeof kaizenDepartmentEvaluations.$inferSelect;

export const DEPARTMENT_DISPLAY_NAMES: Record<DepartmentType, string> = {
  MAINTENANCE: 'Maintenance',
  PRODUCTION: 'Production',
  ASSEMBLY: 'Assembly',
  ADMIN: 'Admin',
  ACCOUNTS: 'Accounts',
};

export const EXPECTED_BENEFITS = [
  'Productivity',
  'Quality', 
  'Cost',
  'Delivery',
  'Safety',
  'Morale'
];

export const EFFECT_OF_CHANGES = [
  'Tool',
  'Fixture',
  'Process',
  'Layout',
  'Machine',
  'PLC',
  'Pneumatic',
  'Electrical'
];

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskLevelType = typeof RISK_LEVELS[number];

export const EVALUATOR_ROLES = ['MANAGER', 'HOD'] as const;
export type EvaluatorRoleType = typeof EVALUATOR_ROLES[number];

export interface EvaluationAnswer {
  questionKey: string;
  answer: 'YES' | 'NO';
  riskLevel: RiskLevelType;
  remarks: string;
}

export interface DepartmentQuestion {
  key: string;
  text: string;
  required: boolean;
}

export const DEPARTMENT_EVALUATION_QUESTIONS: Record<DepartmentType, DepartmentQuestion[]> = {
  MAINTENANCE: [
    { key: 'maint.q1', text: 'Is the PY / improvement accessible in case of breakdown?', required: true },
    { key: 'maint.q2', text: 'Does the improvement require add-on mechanical / electrical accessories?', required: true },
    { key: 'maint.q3', text: 'Is PLC program logic to be modified?', required: true },
    { key: 'maint.q4', text: 'Is spare cost included / manageable in budget?', required: true },
    { key: 'maint.q5', text: 'Will this modification affect the ongoing program?', required: true },
    { key: 'maint.q6', text: 'Is the R&R of the product selected OK?', required: true },
  ],
  PRODUCTION: [
    { key: 'prod.q1', text: 'Is it affecting safety of the producer?', required: true },
    { key: 'prod.q2', text: 'Is training for the producer required?', required: true },
    { key: 'prod.q3', text: 'Is it affecting productivity?', required: true },
    { key: 'prod.q4', text: 'Is it affecting ergonomics / fatigue of the producer?', required: true },
    { key: 'prod.q5', text: 'Is additional manpower required?', required: true },
  ],
  ASSEMBLY: [
    { key: 'asm.q1', text: 'Does the change fit in the machine design?', required: true },
    { key: 'asm.q2', text: 'Is new fixture / jigs / tools / chute (input & output) required?', required: true },
    { key: 'asm.q3', text: 'Is cost for new fixtures / jigs / tools / chute finalized?', required: true },
    { key: 'asm.q4', text: 'Is PFMEA created or modified?', required: true },
    { key: 'asm.q5', text: 'Is there any change in process flow?', required: true },
    { key: 'asm.q6', text: 'Is it affecting the safety of the product?', required: true },
    { key: 'asm.q7', text: 'Is process validation required?', required: true },
    { key: 'asm.q8', text: 'Is it affecting the cycle time?', required: true },
  ],
  ADMIN: [
    { key: 'admin.q1', text: 'Does this change impact any company policies or compliance requirements?', required: true },
    { key: 'admin.q2', text: 'Is documentation update required for administrative records?', required: true },
  ],
  ACCOUNTS: [
    { key: 'acc.q1', text: 'Is budget available for this change?', required: true },
    { key: 'acc.q2', text: 'Is cost justification adequate?', required: true },
    { key: 'acc.q3', text: 'Is financial approval required from higher management?', required: true },
  ],
};
