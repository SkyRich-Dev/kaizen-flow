export type Role = 'INITIATOR' | 'MANAGER' | 'HOD' | 'AGM' | 'GM' | 'ADMIN';

export const DEPARTMENTS = ['MAINTENANCE', 'PRODUCTION', 'MANUFACTURING', 'QUALITY'] as const;
export type DepartmentType = typeof DEPARTMENTS[number];

export type RequestStatus = 
  | 'DRAFT'
  | 'PENDING_OWN_HOD'
  | 'OWN_HOD_REJECTED'
  | 'PENDING_CROSS_MANAGER'
  | 'MANAGER_REJECTED'
  | 'PENDING_CROSS_HOD'
  | 'CROSS_HOD_REJECTED'
  | 'PENDING_AGM'
  | 'AGM_REJECTED'
  | 'PENDING_GM'
  | 'APPROVED'
  | 'REJECTED';

export const STATUS_LABELS: Record<RequestStatus, string> = {
  'DRAFT': 'Draft',
  'PENDING_OWN_HOD': 'Pending Own HOD',
  'OWN_HOD_REJECTED': 'Rejected by Own HOD',
  'PENDING_CROSS_MANAGER': 'Pending Cross-Dept Managers',
  'MANAGER_REJECTED': 'Rejected by Manager',
  'PENDING_CROSS_HOD': 'Pending Cross-HOD Approval',
  'CROSS_HOD_REJECTED': 'Rejected by Cross-HOD',
  'PENDING_AGM': 'Pending AGM Approval',
  'AGM_REJECTED': 'Rejected by AGM',
  'PENDING_GM': 'Pending GM Approval',
  'APPROVED': 'Approved (Final)',
  'REJECTED': 'Rejected (Final)',
};

export const DEPARTMENT_DISPLAY_NAMES: Record<DepartmentType, string> = {
  MAINTENANCE: 'Maintenance',
  PRODUCTION: 'Production',
  MANUFACTURING: 'Manufacturing Engineering',
  QUALITY: 'Quality',
};

export interface User {
  id: number | string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: Role;
  department?: DepartmentType | null;
  departmentId?: number;
  is_hod: boolean;
  is_manager: boolean;
  is_active: boolean;
}

export interface ManagerApproval {
  id: number;
  kaizenId: number;
  managerUserId: string;
  managerUserName?: string;
  departmentId?: number;
  department: DepartmentType;
  decision: 'APPROVED' | 'REJECTED';
  remarks?: string;
  createdAt: string;
}

export interface HodApproval {
  id: number;
  kaizenId: number;
  hodUserId: string;
  hodUserName?: string;
  departmentId?: number;
  department: DepartmentType;
  decision: 'APPROVED' | 'REJECTED';
  remarks?: string;
  stageType: 'OWN_HOD' | 'CROSS_HOD';
  createdAt: string;
}

export interface KaizenRequest {
  id: number;
  requestId: string;
  title: string;
  stationName: string;
  assemblyLine?: string;
  issueDescription: string;
  pokaYokeDescription?: string;
  reasonForImplementation?: string;
  program: string;
  customerPartNumber: string;
  dateOfOrigination: string;
  department: DepartmentType;
  initiatorId: string;
  initiatorName?: string;
  initiatorDepartmentId?: number;
  costEstimate: number;
  costCurrency?: string;
  costJustification?: string;
  spareCostIncluded?: boolean;
  requiresProcessAddition: boolean;
  requiresManpowerAddition: boolean;
  status: RequestStatus;
  currentStage?: 'OWN_HOD' | 'CROSS_MANAGER' | 'CROSS_HOD' | 'AGM' | 'GM' | 'COMPLETED';
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedByDepartment?: DepartmentType;
  createdAt: string;
  updatedAt: string;
  
  managerApprovals?: ManagerApproval[];
  pendingManagers?: DepartmentType[];
  
  hodApprovals?: HodApproval[];
  ownHodApproval?: HodApproval;
  crossHodApprovals?: HodApproval[];
  pendingHods?: DepartmentType[];
  
  agmApproval?: {
    approved: boolean;
    approvedBy: string;
    approvedByName?: string;
    approvedAt: string;
    costJustification?: string;
    comments?: string;
  };
  
  gmApproval?: {
    approved: boolean;
    approvedBy: string;
    approvedByName?: string;
    approvedAt: string;
    costJustification?: string;
    comments?: string;
  };

  attachments?: Array<{ name: string; url: string; uploadedAt: string }>;
  
  managerEvaluations?: DepartmentEvaluation[];
  hodEvaluations?: DepartmentEvaluation[];
  
  isActionableForOwnHod?: boolean;
  isActionableForManager?: boolean;
  isActionableForCrossHod?: boolean;
  isActionableForAGM?: boolean;
  isActionableForGM?: boolean;
}

export interface CostThresholds {
  hodLimit: number;
  agmLimit: number;
}

export interface SLASettings {
  ownHodReviewHours: number;
  crossHodReviewHours: number;
  agmReviewHours: number;
  gmReviewHours: number;
}

export interface SystemSettings {
  costThresholds: CostThresholds;
  sla: SLASettings;
  notifications: {
    emailEnabled: boolean;
    notifyOnSubmission: boolean;
    notifyOnEscalation: boolean;
    notifyOnApproval: boolean;
    notifyOnRejection: boolean;
  };
}

export type ReportType = 'WORKFLOW_PERFORMANCE' | 'KAIZEN_EFFECTIVENESS' | 'COMPLIANCE' | 'COST_ALLOCATION' | 'CUSTOM';

export interface ReportConfig {
  id: string;
  name: string;
  type: ReportType;
  generatedAt?: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type EvaluatorRole = 'MANAGER' | 'HOD';

export interface EvaluationAnswer {
  questionKey: string;
  answer: 'YES' | 'NO';
  riskLevel: RiskLevel;
  remarks: string;
}

export interface DepartmentQuestion {
  key: string;
  text: string;
  required: boolean;
}

export interface DepartmentEvaluation {
  id: number;
  kaizenId: number;
  department: DepartmentType;
  evaluatorUserId: string;
  evaluatorName?: string;
  evaluatorRole: EvaluatorRole;
  evaluationAnswers: EvaluationAnswer[];
  decision: 'APPROVED' | 'REJECTED';
  remarks?: string;
  createdAt: string;
}

export const DEPARTMENT_EVALUATION_QUESTIONS: Record<DepartmentType, DepartmentQuestion[]> = {
  MANUFACTURING: [
    { key: 'mfg.q1', text: 'Does the change fit in the machine design?', required: true },
    { key: 'mfg.q2', text: 'Is new fixture / jigs / tools / chute (input & output) required?', required: true },
    { key: 'mfg.q3', text: 'Is cost for new fixtures / jigs / tools / chute finalized?', required: true },
    { key: 'mfg.q4', text: 'Is PFMEA created or modified?', required: true },
    { key: 'mfg.q5', text: 'Is there any change in process flow?', required: true },
    { key: 'mfg.q6', text: 'Is it affecting the safety of the product?', required: true },
    { key: 'mfg.q7', text: 'Is it requiring any document update (JES / PV / Check sheet / Setup)?', required: true },
    { key: 'mfg.q8', text: 'Is process validation required?', required: true },
    { key: 'mfg.q9', text: 'Is it affecting the cycle time?', required: true },
    { key: 'mfg.q10', text: 'Is the improvement feasible to implement Make & Break type?', required: true },
  ],
  PRODUCTION: [
    { key: 'prod.q1', text: 'Is it affecting safety of the producer?', required: true },
    { key: 'prod.q2', text: 'Is training for the producer required?', required: true },
    { key: 'prod.q3', text: 'Is it affecting productivity?', required: true },
    { key: 'prod.q4', text: 'Is it affecting ergonomics / fatigue of the producer?', required: true },
    { key: 'prod.q5', text: 'Is additional manpower required?', required: true },
  ],
  QUALITY: [
    { key: 'qual.q1', text: 'Is quality validation required?', required: true },
    { key: 'qual.q2', text: 'Is First-Off / Control Plan created or modified?', required: true },
    { key: 'qual.q3', text: 'Is process capability data required?', required: true },
    { key: 'qual.q4', text: 'Is master sample or boundary sample created or modified?', required: true },
    { key: 'qual.q5', text: 'Is PCN required?', required: true },
    { key: 'qual.q6', text: 'Is customer approval required?', required: true },
  ],
  MAINTENANCE: [
    { key: 'maint.q1', text: 'Is the PY / improvement accessible in case of breakdown?', required: true },
    { key: 'maint.q2', text: 'Does the improvement require add-on mechanical / electrical accessories?', required: true },
    { key: 'maint.q3', text: 'Is PLC program logic to be modified?', required: true },
    { key: 'maint.q4', text: 'Is spare cost included / manageable in budget?', required: true },
    { key: 'maint.q5', text: 'Will this modification affect the ongoing program?', required: true },
    { key: 'maint.q6', text: 'Is any V/O add-on required?', required: true },
    { key: 'maint.q7', text: 'Is the R&R of the product selected OK?', required: true },
  ],
};
