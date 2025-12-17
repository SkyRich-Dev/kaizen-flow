import { db } from "./db";
import { 
  users, 
  kaizenRequests, 
  approvals, 
  settings,
  auditLogs,
  kaizenAttachments,
  kaizenHodApprovals,
  kaizenManagerApprovals,
  kaizenDepartmentEvaluations,
  departments,
  type User,
  type KaizenRequest,
  type Approval,
  type Attachment,
  type HodApproval,
  type ManagerApproval,
  type DepartmentEvaluation,
  type Department,
  type DepartmentType,
  DEPARTMENTS,
} from "@shared/schema";
import { eq, and, desc, ne } from "drizzle-orm";

export interface IStorage {
  getDepartment(id: number): Promise<Department | undefined>;
  getDepartmentByName(name: DepartmentType): Promise<Department | undefined>;
  getAllDepartments(): Promise<Department[]>;
  createDepartment(department: any): Promise<Department>;

  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: any): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: any): Promise<User | undefined>;
  getHodByDepartment(department: DepartmentType): Promise<User | undefined>;
  getAllHods(): Promise<User[]>;
  getManagerByDepartment(department: DepartmentType): Promise<User | undefined>;
  getAllManagers(): Promise<User[]>;

  createRequest(request: any): Promise<KaizenRequest>;
  getRequest(id: number): Promise<KaizenRequest | undefined>;
  getRequestByRequestId(requestId: string): Promise<KaizenRequest | undefined>;
  getAllRequests(): Promise<KaizenRequest[]>;
  getRequestsByStatus(status: string): Promise<KaizenRequest[]>;
  getRequestsByInitiator(initiatorId: string): Promise<KaizenRequest[]>;
  getRequestsByDepartment(department: DepartmentType): Promise<KaizenRequest[]>;
  updateRequest(id: number, updates: any): Promise<KaizenRequest | undefined>;

  createManagerApproval(approval: any): Promise<ManagerApproval>;
  getManagerApprovalsByRequest(kaizenId: number): Promise<ManagerApproval[]>;
  getManagerApprovalByRequestAndDept(kaizenId: number, department: DepartmentType): Promise<ManagerApproval | undefined>;

  createHodApproval(approval: any): Promise<HodApproval>;
  getHodApprovalsByRequest(kaizenId: number): Promise<HodApproval[]>;
  getHodApprovalByRequestAndDept(kaizenId: number, department: DepartmentType, stageType: 'OWN_HOD' | 'CROSS_HOD'): Promise<HodApproval | undefined>;
  getOwnHodApproval(kaizenId: number): Promise<HodApproval | undefined>;
  getCrossHodApprovals(kaizenId: number): Promise<HodApproval[]>;

  createApproval(approval: any): Promise<Approval>;
  getApprovalsByRequest(requestId: number): Promise<Approval[]>;
  getApprovalByRequestAndType(requestId: number, approvalType: string): Promise<Approval | undefined>;

  createAttachment(attachment: any): Promise<Attachment>;
  getAttachmentsByRequest(requestId: number): Promise<Attachment[]>;
  deleteAttachment(id: number): Promise<void>;

  getSetting(key: string): Promise<any>;
  updateSetting(key: string, value: any): Promise<void>;

  createAuditLog(log: any): Promise<void>;

  createDepartmentEvaluation(evaluation: any): Promise<DepartmentEvaluation>;
  getDepartmentEvaluationsByRequest(kaizenId: number): Promise<DepartmentEvaluation[]>;
  getDepartmentEvaluationByRequestDeptRole(kaizenId: number, department: DepartmentType, evaluatorRole: 'MANAGER' | 'HOD'): Promise<DepartmentEvaluation | undefined>;
}

export class DBStorage implements IStorage {
  async getDepartment(id: number): Promise<Department | undefined> {
    const result = await db.select().from(departments).where(eq(departments.id, id));
    return result[0];
  }

  async getDepartmentByName(name: DepartmentType): Promise<Department | undefined> {
    const result = await db.select().from(departments).where(eq(departments.name, name));
    return result[0];
  }

  async getAllDepartments(): Promise<Department[]> {
    return await db.select().from(departments).orderBy(departments.name);
  }

  async createDepartment(department: any): Promise<Department> {
    const result = await db.insert(departments).values(department).returning();
    return result[0];
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: any): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, updates: any): Promise<User | undefined> {
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getHodByDepartment(department: DepartmentType): Promise<User | undefined> {
    const result = await db.select().from(users).where(
      and(
        eq(users.department, department),
        eq(users.isHod, true),
        eq(users.active, true)
      )
    );
    return result[0];
  }

  async getAllHods(): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.isHod, true),
        eq(users.active, true)
      )
    );
  }

  async getManagerByDepartment(department: DepartmentType): Promise<User | undefined> {
    const result = await db.select().from(users).where(
      and(
        eq(users.department, department),
        eq(users.isManager, true),
        eq(users.active, true)
      )
    );
    return result[0];
  }

  async getAllManagers(): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.isManager, true),
        eq(users.active, true)
      )
    );
  }

  async createRequest(request: any): Promise<KaizenRequest> {
    const result = await db.insert(kaizenRequests).values(request).returning();
    return result[0];
  }

  async getRequest(id: number): Promise<KaizenRequest | undefined> {
    const result = await db.select().from(kaizenRequests).where(eq(kaizenRequests.id, id));
    return result[0];
  }

  async getRequestByRequestId(requestId: string): Promise<KaizenRequest | undefined> {
    const result = await db.select().from(kaizenRequests).where(eq(kaizenRequests.requestId, requestId));
    return result[0];
  }

  async getAllRequests(): Promise<KaizenRequest[]> {
    return await db.select().from(kaizenRequests).orderBy(desc(kaizenRequests.createdAt));
  }

  async getRequestsByStatus(status: string): Promise<KaizenRequest[]> {
    return await db.select().from(kaizenRequests)
      .where(eq(kaizenRequests.status, status as any))
      .orderBy(desc(kaizenRequests.createdAt));
  }

  async getRequestsByInitiator(initiatorId: string): Promise<KaizenRequest[]> {
    return await db.select().from(kaizenRequests)
      .where(eq(kaizenRequests.initiatorId, initiatorId))
      .orderBy(desc(kaizenRequests.createdAt));
  }

  async getRequestsByDepartment(department: DepartmentType): Promise<KaizenRequest[]> {
    return await db.select().from(kaizenRequests)
      .where(eq(kaizenRequests.department, department))
      .orderBy(desc(kaizenRequests.createdAt));
  }

  async updateRequest(id: number, updates: any): Promise<KaizenRequest | undefined> {
    const result = await db.update(kaizenRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(kaizenRequests.id, id))
      .returning();
    return result[0];
  }

  async createManagerApproval(approval: any): Promise<ManagerApproval> {
    const result = await db.insert(kaizenManagerApprovals).values(approval).returning();
    return result[0];
  }

  async getManagerApprovalsByRequest(kaizenId: number): Promise<ManagerApproval[]> {
    return await db.select().from(kaizenManagerApprovals)
      .where(eq(kaizenManagerApprovals.kaizenId, kaizenId))
      .orderBy(kaizenManagerApprovals.createdAt);
  }

  async getManagerApprovalByRequestAndDept(kaizenId: number, department: DepartmentType): Promise<ManagerApproval | undefined> {
    const result = await db.select().from(kaizenManagerApprovals)
      .where(and(
        eq(kaizenManagerApprovals.kaizenId, kaizenId),
        eq(kaizenManagerApprovals.department, department)
      ));
    return result[0];
  }

  async createHodApproval(approval: any): Promise<HodApproval> {
    const result = await db.insert(kaizenHodApprovals).values(approval).returning();
    return result[0];
  }

  async getHodApprovalsByRequest(kaizenId: number): Promise<HodApproval[]> {
    return await db.select().from(kaizenHodApprovals)
      .where(eq(kaizenHodApprovals.kaizenId, kaizenId))
      .orderBy(kaizenHodApprovals.createdAt);
  }

  async getHodApprovalByRequestAndDept(
    kaizenId: number, 
    department: DepartmentType, 
    stageType: 'OWN_HOD' | 'CROSS_HOD'
  ): Promise<HodApproval | undefined> {
    const result = await db.select().from(kaizenHodApprovals)
      .where(and(
        eq(kaizenHodApprovals.kaizenId, kaizenId),
        eq(kaizenHodApprovals.department, department),
        eq(kaizenHodApprovals.stageType, stageType)
      ));
    return result[0];
  }

  async getOwnHodApproval(kaizenId: number): Promise<HodApproval | undefined> {
    const result = await db.select().from(kaizenHodApprovals)
      .where(and(
        eq(kaizenHodApprovals.kaizenId, kaizenId),
        eq(kaizenHodApprovals.stageType, 'OWN_HOD')
      ));
    return result[0];
  }

  async getCrossHodApprovals(kaizenId: number): Promise<HodApproval[]> {
    return await db.select().from(kaizenHodApprovals)
      .where(and(
        eq(kaizenHodApprovals.kaizenId, kaizenId),
        eq(kaizenHodApprovals.stageType, 'CROSS_HOD')
      ))
      .orderBy(kaizenHodApprovals.createdAt);
  }

  async createApproval(approval: any): Promise<Approval> {
    const result = await db.insert(approvals).values(approval).returning();
    return result[0];
  }

  async getApprovalsByRequest(requestId: number): Promise<Approval[]> {
    return await db.select().from(approvals)
      .where(eq(approvals.requestId, requestId))
      .orderBy(approvals.approvedAt);
  }

  async getApprovalByRequestAndType(requestId: number, approvalType: string): Promise<Approval | undefined> {
    const result = await db.select().from(approvals)
      .where(and(
        eq(approvals.requestId, requestId),
        eq(approvals.approvalType, approvalType as any)
      ));
    return result[0];
  }

  async createAttachment(attachment: any): Promise<Attachment> {
    const result = await db.insert(kaizenAttachments).values(attachment).returning();
    return result[0];
  }

  async getAttachmentsByRequest(requestId: number): Promise<Attachment[]> {
    return await db.select().from(kaizenAttachments)
      .where(eq(kaizenAttachments.requestId, requestId))
      .orderBy(kaizenAttachments.uploadedAt);
  }

  async deleteAttachment(id: number): Promise<void> {
    await db.delete(kaizenAttachments).where(eq(kaizenAttachments.id, id));
  }

  async getSetting(key: string): Promise<any> {
    const result = await db.select().from(settings).where(eq(settings.key, key));
    return result[0]?.value;
  }

  async updateSetting(key: string, value: any): Promise<void> {
    await db.insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() }
      });
  }

  async createAuditLog(log: any): Promise<void> {
    await db.insert(auditLogs).values(log);
  }

  async createDepartmentEvaluation(evaluation: any): Promise<DepartmentEvaluation> {
    const result = await db.insert(kaizenDepartmentEvaluations).values(evaluation).returning();
    return result[0];
  }

  async getDepartmentEvaluationsByRequest(kaizenId: number): Promise<DepartmentEvaluation[]> {
    return await db.select().from(kaizenDepartmentEvaluations)
      .where(eq(kaizenDepartmentEvaluations.kaizenId, kaizenId))
      .orderBy(kaizenDepartmentEvaluations.createdAt);
  }

  async getDepartmentEvaluationByRequestDeptRole(
    kaizenId: number, 
    department: DepartmentType, 
    evaluatorRole: 'MANAGER' | 'HOD'
  ): Promise<DepartmentEvaluation | undefined> {
    const result = await db.select().from(kaizenDepartmentEvaluations)
      .where(and(
        eq(kaizenDepartmentEvaluations.kaizenId, kaizenId),
        eq(kaizenDepartmentEvaluations.department, department),
        eq(kaizenDepartmentEvaluations.evaluatorRole, evaluatorRole)
      ));
    return result[0];
  }
}

export const storage = new DBStorage();
