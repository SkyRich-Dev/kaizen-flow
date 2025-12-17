import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import bcrypt from "bcrypt";
import { z } from "zod";
import { DEPARTMENTS, DEPARTMENT_EVALUATION_QUESTIONS, type DepartmentType, type EvaluationAnswer } from "@shared/schema";

const { Pool } = pg;
const PgSession = connectPgSimple(session);

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

function getUserId(req: any): string | undefined {
  if (req.session?.userId) {
    return req.session.userId;
  }
  const headerUserId = req.headers['x-user-id'];
  if (headerUserId && typeof headerUserId === 'string') {
    return headerUserId;
  }
  return undefined;
}

function requireAuth(req: any, res: any, next: any) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.userId = userId;
  next();
}

function requireRole(...roles: string[]) {
  return async (req: any, res: any, next: any) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    req.user = user;
    req.userId = userId;
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  app.use(session({
    store: new PgSession({
      pool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'kaizen-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    }
  }));

  // ===== AUTH ROUTES =====
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string()
      }).parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.active) {
        return res.status(403).json({ message: "Account is inactive" });
      }

      req.session.userId = user.id;
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to create session" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Please enter a valid email and password" });
      }
      if (error.message?.includes('EAI_AGAIN') || error.message?.includes('ENOTFOUND') || error.message?.includes('connect')) {
        return res.status(503).json({ message: "Database connection unavailable. Please try again in a moment." });
      }
      res.status(400).json({ message: error.message || "Invalid request" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ===== DEPARTMENT ROUTES =====

  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const depts = await storage.getAllDepartments();
      res.json(depts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  // ===== KAIZEN REQUEST ROUTES =====

  async function enrichRequest(request: any) {
    const [hodApprovals, managerApprovals, requestApprovals, initiator, attachments, departmentEvaluations] = await Promise.all([
      storage.getHodApprovalsByRequest(request.id),
      storage.getManagerApprovalsByRequest(request.id),
      storage.getApprovalsByRequest(request.id),
      storage.getUser(request.initiatorId),
      storage.getAttachmentsByRequest(request.id),
      storage.getDepartmentEvaluationsByRequest(request.id)
    ]);

    const enrichedHodApprovals = await Promise.all(hodApprovals.map(async (approval) => {
      const hodUser = await storage.getUser(approval.hodUserId);
      return {
        ...approval,
        hodUserName: hodUser?.name
      };
    }));

    const enrichedManagerApprovals = await Promise.all(managerApprovals.map(async (approval) => {
      const managerUser = await storage.getUser(approval.managerUserId);
      return {
        ...approval,
        managerUserName: managerUser?.name
      };
    }));

    const ownHodApproval = enrichedHodApprovals.find(a => a.stageType === 'OWN_HOD');
    const crossHodApprovals = enrichedHodApprovals.filter(a => a.stageType === 'CROSS_HOD');

    const agmApproval = requestApprovals.find(a => a.approvalType === 'AGM');
    const gmApproval = requestApprovals.find(a => a.approvalType === 'GM');

    let enrichedAgmApproval: any = agmApproval;
    let enrichedGmApproval: any = gmApproval;

    if (agmApproval) {
      const agmUser = await storage.getUser(agmApproval.approvedBy);
      enrichedAgmApproval = { ...agmApproval, approvedByName: agmUser?.name };
    }
    if (gmApproval) {
      const gmUser = await storage.getUser(gmApproval.approvedBy);
      enrichedGmApproval = { ...gmApproval, approvedByName: gmUser?.name };
    }

    const allOtherDepts = DEPARTMENTS.filter(d => d !== request.department);

    const approvedManagerDepts = enrichedManagerApprovals.filter(a => a.decision === 'APPROVED').map(a => a.department);
    const pendingManagers = allOtherDepts.filter(d => !approvedManagerDepts.includes(d));

    const approvedCrossHodDepts = crossHodApprovals.filter(a => a.decision === 'APPROVED').map(a => a.department);
    const pendingHods = allOtherDepts.filter(d => !approvedCrossHodDepts.includes(d));

    let currentStage = 'OWN_HOD';
    switch (request.status) {
      case 'PENDING_OWN_HOD': currentStage = 'OWN_HOD'; break;
      case 'PENDING_CROSS_MANAGER': currentStage = 'CROSS_MANAGER'; break;
      case 'PENDING_CROSS_HOD': currentStage = 'CROSS_HOD'; break;
      case 'PENDING_AGM': currentStage = 'AGM'; break;
      case 'PENDING_GM': currentStage = 'GM'; break;
      case 'APPROVED': case 'REJECTED': currentStage = 'COMPLETED'; break;
    }

    const managerEvaluations = departmentEvaluations.filter(e => e.evaluatorRole === 'MANAGER');
    const hodEvaluations = departmentEvaluations.filter(e => e.evaluatorRole === 'HOD');

    const enrichedManagerEvaluations = await Promise.all(managerEvaluations.map(async (evaluation) => {
      const evaluator = await storage.getUser(evaluation.evaluatorUserId);
      return { ...evaluation, evaluatorName: evaluator?.name };
    }));

    const enrichedHodEvaluations = await Promise.all(hodEvaluations.map(async (evaluation) => {
      const evaluator = await storage.getUser(evaluation.evaluatorUserId);
      return { ...evaluation, evaluatorName: evaluator?.name };
    }));

    return {
      ...request,
      initiatorName: initiator?.name,
      hodApprovals: enrichedHodApprovals,
      managerApprovals: enrichedManagerApprovals,
      ownHodApproval,
      crossHodApprovals,
      pendingManagers: request.status === 'PENDING_CROSS_MANAGER' ? pendingManagers : [],
      pendingHods: request.status === 'PENDING_CROSS_HOD' ? pendingHods : [],
      agmApproval: enrichedAgmApproval,
      gmApproval: enrichedGmApproval,
      attachments: attachments || [],
      currentStage,
      isActionableForAGM: request.status === 'PENDING_AGM',
      isActionableForGM: request.status === 'PENDING_GM',
      managerEvaluations: enrichedManagerEvaluations,
      hodEvaluations: enrichedHodEvaluations,
    };
  }

  app.get("/api/requests", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let requests = await storage.getAllRequests();
      const enrichedRequests = await Promise.all(requests.map(enrichRequest));

      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.get("/api/requests/:requestId", requireAuth, async (req, res) => {
    try {
      const request = await storage.getRequestByRequestId(req.params.requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      const enrichedRequest = await enrichRequest(request);
      res.json(enrichedRequest);
    } catch (error) {
      console.error("Error fetching request:", error);
      res.status(500).json({ message: "Failed to fetch request" });
    }
  });

  app.post("/api/requests", requireRole('INITIATOR'), async (req: any, res) => {
    try {
      const requestData = z.object({
        title: z.string(),
        stationName: z.string(),
        assemblyLine: z.string().optional(),
        issueDescription: z.string(),
        pokaYokeDescription: z.string().optional(),
        reasonForImplementation: z.string().optional(),
        program: z.string(),
        customerPartNumber: z.string(),
        dateOfOrigination: z.string(),
        department: z.enum(DEPARTMENTS),
        feasibilityStatus: z.enum(['FEASIBLE', 'NOT_FEASIBLE']).optional(),
        feasibilityReason: z.string().optional(),
        expectedBenefits: z.array(z.string()).optional(),
        effectOfChanges: z.array(z.string()).optional(),
        costEstimate: z.number(),
        costJustification: z.string().optional(),
        spareCostIncluded: z.boolean().optional(),
        requiresProcessAddition: z.boolean(),
        requiresManpowerAddition: z.boolean(),
      }).parse(req.body);

      const allRequests = await storage.getAllRequests();
      const year = new Date().getFullYear();
      const nextNumber = allRequests.length + 1;
      const requestId = `KZ-${year}-${String(nextNumber).padStart(3, '0')}`;

      const user = await storage.getUser(req.userId);
      const dept = user?.department ? await storage.getDepartmentByName(user.department) : undefined;

      const request = await storage.createRequest({
        ...requestData,
        requestId,
        initiatorId: req.userId,
        initiatorDepartmentId: dept?.id,
        status: 'PENDING_OWN_HOD',
        currentStage: 'OWN_HOD',
      });

      await storage.createAuditLog({
        requestId: request.id,
        userId: req.userId,
        action: 'REQUEST_CREATED',
        details: { requestId: request.requestId, department: requestData.department }
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating request:", error);
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  // ===== HOD APPROVAL ROUTES =====

  app.post("/api/kaizen/:requestId/own-hod-decision", requireRole('HOD'), async (req: any, res) => {
    try {
      const request = await storage.getRequestByRequestId(req.params.requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (request.status !== 'PENDING_OWN_HOD') {
        return res.status(400).json({ message: "Request is not pending own HOD approval" });
      }

      const user = await storage.getUser(req.userId);
      if (!user || !user.isHod || user.department !== request.department) {
        return res.status(403).json({ message: "You are not the HOD for this department" });
      }

      const decisionData = z.object({
        decision: z.enum(['APPROVED', 'REJECTED']),
        remarks: z.string().optional(),
      }).parse(req.body);

      if (decisionData.decision === 'REJECTED' && !decisionData.remarks) {
        return res.status(400).json({ message: "Remarks are mandatory for rejection" });
      }

      const dept = await storage.getDepartmentByName(user.department!);

      await storage.createHodApproval({
        kaizenId: request.id,
        hodUserId: req.userId,
        departmentId: dept?.id,
        department: user.department,
        decision: decisionData.decision,
        remarks: decisionData.remarks,
        stageType: 'OWN_HOD',
      });

      if (decisionData.decision === 'REJECTED') {
        await storage.updateRequest(request.id, {
          status: 'OWN_HOD_REJECTED',
          rejectionReason: decisionData.remarks,
          rejectedBy: req.userId,
          rejectedByDepartment: user.department,
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: 'OWN_HOD_REJECTED',
          details: { department: user.department, remarks: decisionData.remarks }
        });
      } else {
        await storage.updateRequest(request.id, {
          status: 'PENDING_CROSS_MANAGER',
          currentStage: 'CROSS_MANAGER',
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: 'OWN_HOD_APPROVED',
          details: { department: user.department }
        });
      }

      res.json({ message: `Own HOD decision recorded: ${decisionData.decision}` });
    } catch (error) {
      console.error("Error processing own HOD decision:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // ===== MANAGER APPROVAL ROUTES =====

  app.post("/api/kaizen/:requestId/manager-decision", requireRole('MANAGER'), async (req: any, res) => {
    try {
      const request = await storage.getRequestByRequestId(req.params.requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (request.status !== 'PENDING_CROSS_MANAGER') {
        return res.status(400).json({ message: "Request is not pending cross-department manager approval" });
      }

      const user = await storage.getUser(req.userId);
      if (!user || !user.isManager) {
        return res.status(403).json({ message: "You are not a Manager" });
      }

      if (user.department === request.department) {
        return res.status(400).json({ message: "Own department manager cannot approve. Only cross-department managers." });
      }

      const existingApproval = await storage.getManagerApprovalByRequestAndDept(request.id, user.department!);
      if (existingApproval) {
        return res.status(400).json({ message: "You have already submitted your decision" });
      }

      const departmentQuestions = DEPARTMENT_EVALUATION_QUESTIONS[user.department!];
      if (departmentQuestions && departmentQuestions.length > 0) {
        const existingEvaluation = await storage.getDepartmentEvaluationByRequestDeptRole(
          request.id,
          user.department!,
          'MANAGER'
        );
        if (!existingEvaluation) {
          return res.status(400).json({ 
            message: "Your department requires a completed evaluation before approval. Please use the evaluation form." 
          });
        }
      }

      const decisionData = z.object({
        decision: z.enum(['APPROVED', 'REJECTED']),
        remarks: z.string().optional(),
      }).parse(req.body);

      if (decisionData.decision === 'REJECTED' && !decisionData.remarks) {
        return res.status(400).json({ message: "Remarks are mandatory for rejection" });
      }

      const dept = await storage.getDepartmentByName(user.department!);

      await storage.createManagerApproval({
        kaizenId: request.id,
        managerUserId: req.userId,
        departmentId: dept?.id,
        department: user.department,
        decision: decisionData.decision,
        remarks: decisionData.remarks,
      });

      await storage.createAuditLog({
        requestId: request.id,
        userId: req.userId,
        action: decisionData.decision === 'APPROVED' ? 'MANAGER_APPROVED' : 'MANAGER_REJECTED',
        details: { department: user.department, remarks: decisionData.remarks }
      });

      if (decisionData.decision === 'REJECTED') {
        await storage.updateRequest(request.id, {
          status: 'MANAGER_REJECTED',
          rejectionReason: `Rejected by ${user.department} Manager: ${decisionData.remarks}`,
          rejectedBy: req.userId,
          rejectedByDepartment: user.department,
        });
        return res.json({ message: "Manager rejection recorded. Workflow stopped." });
      }

      const allManagerApprovals = await storage.getManagerApprovalsByRequest(request.id);
      const otherDepartments = DEPARTMENTS.filter(d => d !== request.department);
      const allApproved = otherDepartments.every(dept => 
        allManagerApprovals.some(a => a.department === dept && a.decision === 'APPROVED')
      );

      if (allApproved) {
        await storage.updateRequest(request.id, {
          status: 'PENDING_CROSS_HOD',
          currentStage: 'CROSS_HOD',
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: 'ALL_MANAGERS_APPROVED',
          details: { totalApprovals: allManagerApprovals.length }
        });
      }

      res.json({ message: "Manager decision recorded" });
    } catch (error) {
      console.error("Error processing manager decision:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/kaizen/:requestId/department-evaluation", requireAuth, async (req: any, res) => {
    try {
      const request = await storage.getRequestByRequestId(req.params.requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }

      let evaluatorRole: 'MANAGER' | 'HOD';
      if (request.status === 'PENDING_CROSS_MANAGER' && user.role === 'MANAGER') {
        evaluatorRole = 'MANAGER';
      } else if (request.status === 'PENDING_CROSS_HOD' && user.role === 'HOD') {
        evaluatorRole = 'HOD';
      } else {
        return res.status(400).json({ message: "Request is not at the appropriate stage for your role" });
      }

      if (user.department === request.department) {
        return res.status(400).json({ message: "Own department evaluation not required at this stage" });
      }

      const existingEvaluation = await storage.getDepartmentEvaluationByRequestDeptRole(
        request.id,
        user.department!,
        evaluatorRole
      );
      if (existingEvaluation) {
        return res.status(400).json({ message: "You have already submitted your evaluation" });
      }

      const departmentQuestions = DEPARTMENT_EVALUATION_QUESTIONS[user.department!];
      if (!departmentQuestions || departmentQuestions.length === 0) {
        return res.status(400).json({ message: "No evaluation questions defined for your department" });
      }

      const evaluationSchema = z.object({
        answers: z.array(z.object({
          questionKey: z.string(),
          answer: z.enum(['YES', 'NO']),
          riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
          remarks: z.string(),
        })),
        decision: z.enum(['APPROVED', 'REJECTED']),
        remarks: z.string().optional(),
      });

      const evaluationData = evaluationSchema.parse(req.body);

      const allQuestionKeys = departmentQuestions.map(q => q.key);
      const requiredQuestionKeys = departmentQuestions.filter(q => q.required).map(q => q.key);
      const submittedQuestionKeys = evaluationData.answers.map(a => a.questionKey);
      
      const uniqueSubmittedKeys = new Set(submittedQuestionKeys);
      if (uniqueSubmittedKeys.size !== submittedQuestionKeys.length) {
        return res.status(400).json({ message: "Duplicate question answers detected" });
      }

      const invalidKeys = submittedQuestionKeys.filter(k => !allQuestionKeys.includes(k));
      if (invalidKeys.length > 0) {
        return res.status(400).json({ 
          message: "Invalid question keys submitted", 
          invalidKeys 
        });
      }

      const missingQuestions = requiredQuestionKeys.filter(k => !submittedQuestionKeys.includes(k));
      if (missingQuestions.length > 0) {
        return res.status(400).json({ 
          message: "Not all required questions answered", 
          missingQuestions 
        });
      }

      if (submittedQuestionKeys.length !== allQuestionKeys.length) {
        return res.status(400).json({ 
          message: `Expected ${allQuestionKeys.length} answers but received ${submittedQuestionKeys.length}` 
        });
      }

      for (const answer of evaluationData.answers) {
        if ((answer.answer === 'NO' || answer.riskLevel === 'HIGH') && !answer.remarks.trim()) {
          return res.status(400).json({ 
            message: `Remarks are mandatory when answer is 'No' or risk is 'High' for question ${answer.questionKey}` 
          });
        }
      }

      if (evaluationData.decision === 'REJECTED' && !evaluationData.remarks) {
        return res.status(400).json({ message: "Remarks are mandatory for rejection" });
      }

      await storage.createDepartmentEvaluation({
        kaizenId: request.id,
        department: user.department,
        evaluatorUserId: req.userId,
        evaluatorRole,
        evaluationAnswers: evaluationData.answers,
        decision: evaluationData.decision,
        remarks: evaluationData.remarks,
      });

      const dept = await storage.getDepartmentByName(user.department!);

      if (evaluatorRole === 'MANAGER') {
        await storage.createManagerApproval({
          kaizenId: request.id,
          managerUserId: req.userId,
          departmentId: dept?.id,
          department: user.department,
          decision: evaluationData.decision,
          remarks: evaluationData.remarks,
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: evaluationData.decision === 'APPROVED' ? 'MANAGER_APPROVED' : 'MANAGER_REJECTED',
          details: { department: user.department, remarks: evaluationData.remarks, hasEvaluation: true }
        });

        if (evaluationData.decision === 'REJECTED') {
          await storage.updateRequest(request.id, {
            status: 'MANAGER_REJECTED',
            rejectionReason: `Rejected by ${user.department} Manager: ${evaluationData.remarks}`,
            rejectedBy: req.userId,
            rejectedByDepartment: user.department,
          });
          return res.json({ message: "Evaluation submitted, request rejected by manager" });
        }

        const allManagerApprovals = await storage.getManagerApprovalsByRequest(request.id);
        const otherDepartments = DEPARTMENTS.filter(d => d !== request.department);
        const approvedDepts = allManagerApprovals.filter(a => a.decision === 'APPROVED').map(a => a.department);
        const allApproved = otherDepartments.every(d => approvedDepts.includes(d));

        if (allApproved) {
          await storage.updateRequest(request.id, { status: 'PENDING_CROSS_HOD' });
        }
      } else if (evaluatorRole === 'HOD') {
        await storage.createHodApproval({
          kaizenId: request.id,
          hodUserId: req.userId,
          departmentId: dept?.id,
          department: user.department,
          stageType: 'CROSS_HOD',
          decision: evaluationData.decision,
          remarks: evaluationData.remarks,
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: evaluationData.decision === 'APPROVED' ? 'CROSS_HOD_APPROVED' : 'CROSS_HOD_REJECTED',
          details: { department: user.department, remarks: evaluationData.remarks, hasEvaluation: true }
        });

        if (evaluationData.decision === 'REJECTED') {
          await storage.updateRequest(request.id, {
            status: 'CROSS_HOD_REJECTED',
            rejectionReason: `Rejected by ${user.department} HOD: ${evaluationData.remarks}`,
            rejectedBy: req.userId,
            rejectedByDepartment: user.department,
          });
          return res.json({ message: "Evaluation submitted, request rejected by HOD" });
        }

        const allHodApprovals = await storage.getHodApprovalsByRequest(request.id);
        const crossHodApprovals = allHodApprovals.filter(a => a.stageType === 'CROSS_HOD');
        const otherDepartments = DEPARTMENTS.filter(d => d !== request.department);
        const approvedDepts = crossHodApprovals.filter(a => a.decision === 'APPROVED').map(a => a.department);
        const allApproved = otherDepartments.every(d => approvedDepts.includes(d));

        if (allApproved) {
          const costThresholdsSetting = await storage.getSetting('costThresholds');
          const thresholds = costThresholdsSetting || { hodLimit: 50000, agmLimit: 100000 };

          if (request.costEstimate > thresholds.agmLimit || request.requiresProcessAddition || request.requiresManpowerAddition) {
            await storage.updateRequest(request.id, { status: 'PENDING_AGM' });
          } else if (request.costEstimate > thresholds.hodLimit) {
            await storage.updateRequest(request.id, { status: 'PENDING_AGM' });
          } else {
            await storage.updateRequest(request.id, { status: 'APPROVED' });
          }
        }
      }

      res.json({ message: "Evaluation and decision submitted successfully" });
    } catch (error) {
      console.error("Error submitting department evaluation:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get("/api/kaizen/:requestId/department-evaluations", requireAuth, async (req: any, res) => {
    try {
      const request = await storage.getRequestByRequestId(req.params.requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      const evaluations = await storage.getDepartmentEvaluationsByRequest(request.id);

      const enrichedEvaluations = await Promise.all(evaluations.map(async (evaluation) => {
        const evaluator = await storage.getUser(evaluation.evaluatorUserId);
        return {
          ...evaluation,
          evaluatorName: evaluator?.name,
        };
      }));

      res.json(enrichedEvaluations);
    } catch (error) {
      console.error("Error fetching department evaluations:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/kaizen/:requestId/cross-hod-decision", requireRole('HOD'), async (req: any, res) => {
    try {
      const request = await storage.getRequestByRequestId(req.params.requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (request.status !== 'PENDING_CROSS_HOD') {
        return res.status(400).json({ message: "Request is not pending cross-HOD approval" });
      }

      const user = await storage.getUser(req.userId);
      if (!user || !user.isHod) {
        return res.status(403).json({ message: "You are not an HOD" });
      }

      if (user.department === request.department) {
        return res.status(400).json({ message: "Own department HOD already approved. Waiting for other HODs." });
      }

      const existingApproval = await storage.getHodApprovalByRequestAndDept(
        request.id, 
        user.department!, 
        'CROSS_HOD'
      );
      if (existingApproval) {
        return res.status(400).json({ message: "You have already submitted your decision" });
      }

      const departmentQuestions = DEPARTMENT_EVALUATION_QUESTIONS[user.department!];
      if (departmentQuestions && departmentQuestions.length > 0) {
        const existingEvaluation = await storage.getDepartmentEvaluationByRequestDeptRole(
          request.id,
          user.department!,
          'HOD'
        );
        if (!existingEvaluation) {
          return res.status(400).json({ 
            message: "Your department requires a completed evaluation before approval. Please use the evaluation form." 
          });
        }
      }

      const decisionData = z.object({
        decision: z.enum(['APPROVED', 'REJECTED']),
        remarks: z.string().optional(),
      }).parse(req.body);

      if (decisionData.decision === 'REJECTED' && !decisionData.remarks) {
        return res.status(400).json({ message: "Remarks are mandatory for rejection" });
      }

      const dept = await storage.getDepartmentByName(user.department!);

      await storage.createHodApproval({
        kaizenId: request.id,
        hodUserId: req.userId,
        departmentId: dept?.id,
        department: user.department,
        decision: decisionData.decision,
        remarks: decisionData.remarks,
        stageType: 'CROSS_HOD',
      });

      await storage.createAuditLog({
        requestId: request.id,
        userId: req.userId,
        action: decisionData.decision === 'APPROVED' ? 'CROSS_HOD_APPROVED' : 'CROSS_HOD_REJECTED',
        details: { department: user.department, remarks: decisionData.remarks }
      });

      if (decisionData.decision === 'REJECTED') {
        await storage.updateRequest(request.id, {
          status: 'CROSS_HOD_REJECTED',
          rejectionReason: `Rejected by ${user.department} HOD: ${decisionData.remarks}`,
          rejectedBy: req.userId,
          rejectedByDepartment: user.department,
        });
        return res.json({ message: "Cross-HOD rejection recorded. Workflow stopped." });
      }

      const allCrossApprovals = await storage.getCrossHodApprovals(request.id);
      const otherDepartments = DEPARTMENTS.filter(d => d !== request.department);
      const allApproved = otherDepartments.every(dept => 
        allCrossApprovals.some(a => a.department === dept && a.decision === 'APPROVED')
      );

      if (allApproved) {
        await storage.updateRequest(request.id, {
          status: 'PENDING_AGM',
          currentStage: 'AGM',
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: 'ALL_CROSS_HOD_APPROVED',
          details: { totalApprovals: allCrossApprovals.length }
        });
      }

      res.json({ message: "Cross-HOD decision recorded" });
    } catch (error) {
      console.error("Error processing cross-HOD decision:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // ===== AGM/GM APPROVAL ROUTES =====

  app.post("/api/kaizen/:requestId/agm-decision", requireRole('AGM'), async (req: any, res) => {
    try {
      const request = await storage.getRequestByRequestId(req.params.requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (request.status !== 'PENDING_AGM') {
        return res.status(400).json({ message: "Request is not pending AGM approval" });
      }

      const decisionData = z.object({
        approved: z.boolean(),
        comments: z.string().optional(),
        costJustification: z.string().optional(),
      }).parse(req.body);

      if (!decisionData.approved && !decisionData.comments) {
        return res.status(400).json({ message: "Comments are mandatory for rejection" });
      }

      await storage.createApproval({
        requestId: request.id,
        approvalType: 'AGM',
        approvedBy: req.userId,
        approved: decisionData.approved,
        comments: decisionData.comments,
        costJustification: decisionData.costJustification,
      });

      if (!decisionData.approved) {
        await storage.updateRequest(request.id, {
          status: 'AGM_REJECTED',
          rejectionReason: `Rejected by AGM: ${decisionData.comments}`,
          rejectedBy: req.userId,
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: 'AGM_REJECTED',
          details: { comments: decisionData.comments }
        });
      } else {
        await storage.updateRequest(request.id, {
          status: 'PENDING_GM',
          currentStage: 'GM',
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: 'AGM_APPROVED',
          details: { costJustification: decisionData.costJustification }
        });
      }

      res.json({ message: `AGM decision recorded: ${decisionData.approved ? 'Approved' : 'Rejected'}` });
    } catch (error) {
      console.error("Error processing AGM decision:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/kaizen/:requestId/gm-decision", requireRole('GM'), async (req: any, res) => {
    try {
      const request = await storage.getRequestByRequestId(req.params.requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (request.status !== 'PENDING_GM') {
        return res.status(400).json({ message: "Request is not pending GM approval" });
      }

      const decisionData = z.object({
        approved: z.boolean(),
        comments: z.string().optional(),
        costJustification: z.string().optional(),
      }).parse(req.body);

      if (!decisionData.approved && !decisionData.comments) {
        return res.status(400).json({ message: "Comments are mandatory for rejection" });
      }

      await storage.createApproval({
        requestId: request.id,
        approvalType: 'GM',
        approvedBy: req.userId,
        approved: decisionData.approved,
        comments: decisionData.comments,
        costJustification: decisionData.costJustification,
      });

      if (!decisionData.approved) {
        await storage.updateRequest(request.id, {
          status: 'REJECTED',
          rejectionReason: `Final rejection by GM: ${decisionData.comments}`,
          rejectedBy: req.userId,
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: 'GM_REJECTED',
          details: { comments: decisionData.comments }
        });
      } else {
        await storage.updateRequest(request.id, {
          status: 'APPROVED',
          currentStage: 'COMPLETED',
        });

        await storage.createAuditLog({
          requestId: request.id,
          userId: req.userId,
          action: 'GM_APPROVED',
          details: { costJustification: decisionData.costJustification }
        });
      }

      res.json({ message: `GM decision recorded: ${decisionData.approved ? 'Final Approved' : 'Final Rejected'}` });
    } catch (error) {
      console.error("Error processing GM decision:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // ===== SETTINGS ROUTES =====

  app.get("/api/settings/thresholds", requireAuth, async (req, res) => {
    try {
      const costThresholds = await storage.getSetting('costThresholds') || { hodLimit: 50000, agmLimit: 100000 };
      res.json({ costThresholds });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch thresholds" });
    }
  });

  app.get("/api/settings", requireRole('ADMIN'), async (req, res) => {
    try {
      const [costThresholds, sla, notifications] = await Promise.all([
        storage.getSetting('costThresholds'),
        storage.getSetting('sla'),
        storage.getSetting('notifications'),
      ]);

      res.json({
        costThresholds: costThresholds || { hodLimit: 50000, agmLimit: 100000 },
        sla: sla || { ownHodReviewHours: 12, crossHodReviewHours: 24, agmReviewHours: 24, gmReviewHours: 48 },
        notifications: notifications || {
          emailEnabled: false,
          notifyOnSubmission: true,
          notifyOnEscalation: true,
          notifyOnApproval: true,
          notifyOnRejection: true
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", requireRole('ADMIN'), async (req: any, res) => {
    try {
      const settings = z.object({
        costThresholds: z.object({
          hodLimit: z.number(),
          agmLimit: z.number(),
        }).optional(),
        sla: z.object({
          ownHodReviewHours: z.number(),
          crossHodReviewHours: z.number(),
          agmReviewHours: z.number(),
          gmReviewHours: z.number(),
        }).optional(),
        notifications: z.object({
          emailEnabled: z.boolean(),
          notifyOnSubmission: z.boolean(),
          notifyOnEscalation: z.boolean(),
          notifyOnApproval: z.boolean(),
          notifyOnRejection: z.boolean(),
        }).optional(),
      }).parse(req.body);

      const updatePromises = [];
      if (settings.costThresholds) {
        updatePromises.push(storage.updateSetting('costThresholds', settings.costThresholds));
      }
      if (settings.sla) {
        updatePromises.push(storage.updateSetting('sla', settings.sla));
      }
      if (settings.notifications) {
        updatePromises.push(storage.updateSetting('notifications', settings.notifications));
      }

      await Promise.all(updatePromises);

      await storage.createAuditLog({
        requestId: null as any,
        userId: req.userId,
        action: 'SETTINGS_UPDATED',
        details: settings
      });

      res.json({ message: "Settings updated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // ===== USER MANAGEMENT ROUTES =====

  app.get("/api/users", requireRole('ADMIN'), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/hods", requireAuth, async (req, res) => {
    try {
      const hods = await storage.getAllHods();
      const hodsWithoutPasswords = hods.map(({ password, ...user }) => user);
      res.json(hodsWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch HODs" });
    }
  });

  app.post("/api/users", requireRole('ADMIN'), async (req, res) => {
    try {
      const userData = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string(),
        role: z.enum(['INITIATOR', 'HOD', 'AGM', 'GM', 'ADMIN']),
        department: z.enum(DEPARTMENTS).optional(),
        isHod: z.boolean().optional(),
        active: z.boolean().optional(),
      }).parse(req.body);

      const hashedPassword = await bcrypt.hash(userData.password, 10);

      let departmentId: number | undefined;
      if (userData.department) {
        const dept = await storage.getDepartmentByName(userData.department);
        departmentId = dept?.id;
      }

      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        departmentId,
        isHod: userData.isHod ?? false,
        active: userData.active ?? true,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.put("/api/users/:id", requireRole('ADMIN'), async (req, res) => {
    try {
      const updates = z.object({
        name: z.string().optional(),
        role: z.enum(['INITIATOR', 'HOD', 'AGM', 'GM', 'ADMIN']).optional(),
        department: z.enum(DEPARTMENTS).optional(),
        isHod: z.boolean().optional(),
        active: z.boolean().optional(),
      }).parse(req.body);

      let departmentId: number | undefined;
      if (updates.department) {
        const dept = await storage.getDepartmentByName(updates.department);
        departmentId = dept?.id;
      }

      const user = await storage.updateUser(req.params.id, { ...updates, departmentId });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  return httpServer;
}
