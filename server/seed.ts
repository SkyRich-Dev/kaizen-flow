import { db } from './db';
import { users, settings, kaizenRequests, approvals, auditLogs, departments, kaizenHodApprovals, kaizenManagerApprovals, kaizenAttachments, DEPARTMENTS, type DepartmentType } from '@shared/schema';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding database...');

  await db.delete(auditLogs);
  await db.delete(kaizenHodApprovals);
  await db.delete(kaizenManagerApprovals);
  await db.delete(approvals);
  await db.delete(kaizenAttachments);
  await db.delete(kaizenRequests);
  await db.delete(users);
  await db.delete(departments);
  await db.delete(settings);

  const createdDepts = await db.insert(departments).values([
    { name: 'MAINTENANCE', displayName: 'Maintenance' },
    { name: 'PRODUCTION', displayName: 'Production' },
    { name: 'ASSEMBLY', displayName: 'Assembly' },
    { name: 'ADMIN', displayName: 'Admin' },
    { name: 'ACCOUNTS', displayName: 'Accounts' },
  ]).returning();

  console.log(`Created ${createdDepts.length} departments`);

  const deptMap: Record<DepartmentType, number> = {} as any;
  for (const dept of createdDepts) {
    deptMap[dept.name] = dept.id;
  }

  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const createdUsers = await db.insert(users).values([
    { email: 'init.maint@company.com', password: hashedPassword, name: 'Raj Kumar (Maint)', role: 'INITIATOR', department: 'MAINTENANCE', departmentId: deptMap.MAINTENANCE, isHod: false, isManager: false, active: true },
    { email: 'init.prod@company.com', password: hashedPassword, name: 'Amit Sharma (Prod)', role: 'INITIATOR', department: 'PRODUCTION', departmentId: deptMap.PRODUCTION, isHod: false, isManager: false, active: true },
    { email: 'init.assembly@company.com', password: hashedPassword, name: 'Priya Patel (Assm)', role: 'INITIATOR', department: 'ASSEMBLY', departmentId: deptMap.ASSEMBLY, isHod: false, isManager: false, active: true },
    { email: 'init.admin@company.com', password: hashedPassword, name: 'Sunita Verma (Admin)', role: 'INITIATOR', department: 'ADMIN', departmentId: deptMap.ADMIN, isHod: false, isManager: false, active: true },
    { email: 'init.accounts@company.com', password: hashedPassword, name: 'Ravi Gupta (Acc)', role: 'INITIATOR', department: 'ACCOUNTS', departmentId: deptMap.ACCOUNTS, isHod: false, isManager: false, active: true },
    
    { email: 'mgr.maint@company.com', password: hashedPassword, name: 'Arun Mgr (Maint)', role: 'MANAGER', department: 'MAINTENANCE', departmentId: deptMap.MAINTENANCE, isHod: false, isManager: true, active: true },
    { email: 'mgr.prod@company.com', password: hashedPassword, name: 'Neha Mgr (Prod)', role: 'MANAGER', department: 'PRODUCTION', departmentId: deptMap.PRODUCTION, isHod: false, isManager: true, active: true },
    { email: 'mgr.assembly@company.com', password: hashedPassword, name: 'Rohit Mgr (Assm)', role: 'MANAGER', department: 'ASSEMBLY', departmentId: deptMap.ASSEMBLY, isHod: false, isManager: true, active: true },
    { email: 'mgr.admin@company.com', password: hashedPassword, name: 'Pooja Mgr (Admin)', role: 'MANAGER', department: 'ADMIN', departmentId: deptMap.ADMIN, isHod: false, isManager: true, active: true },
    { email: 'mgr.accounts@company.com', password: hashedPassword, name: 'Vijay Mgr (Acc)', role: 'MANAGER', department: 'ACCOUNTS', departmentId: deptMap.ACCOUNTS, isHod: false, isManager: true, active: true },
    
    { email: 'hod.maint@company.com', password: hashedPassword, name: 'Suresh HOD (Maint)', role: 'HOD', department: 'MAINTENANCE', departmentId: deptMap.MAINTENANCE, isHod: true, isManager: false, active: true },
    { email: 'hod.prod@company.com', password: hashedPassword, name: 'Vikram HOD (Prod)', role: 'HOD', department: 'PRODUCTION', departmentId: deptMap.PRODUCTION, isHod: true, isManager: false, active: true },
    { email: 'hod.assembly@company.com', password: hashedPassword, name: 'Meena HOD (Assm)', role: 'HOD', department: 'ASSEMBLY', departmentId: deptMap.ASSEMBLY, isHod: true, isManager: false, active: true },
    { email: 'hod.admin@company.com', password: hashedPassword, name: 'Deepak HOD (Admin)', role: 'HOD', department: 'ADMIN', departmentId: deptMap.ADMIN, isHod: true, isManager: false, active: true },
    { email: 'hod.accounts@company.com', password: hashedPassword, name: 'Kavita HOD (Acc)', role: 'HOD', department: 'ACCOUNTS', departmentId: deptMap.ACCOUNTS, isHod: true, isManager: false, active: true },
    
    { email: 'agm@company.com', password: hashedPassword, name: 'Manoj AGM', role: 'AGM', department: null, departmentId: null, isHod: false, isManager: false, active: true },
    { email: 'gm@company.com', password: hashedPassword, name: 'Sanjay GM', role: 'GM', department: null, departmentId: null, isHod: false, isManager: false, active: true },
    { email: 'admin@company.com', password: hashedPassword, name: 'Admin User', role: 'ADMIN', department: null, departmentId: null, isHod: false, isManager: false, active: true },
  ]).returning();

  console.log(`Created ${createdUsers.length} users`);

  await db.insert(settings).values([
    { key: 'costThresholds', value: { hodLimit: 50000, agmLimit: 100000 } },
    { key: 'sla', value: { ownHodReviewHours: 12, crossHodReviewHours: 24, agmReviewHours: 24, gmReviewHours: 48 } },
    { key: 'notifications', value: { emailEnabled: false, notifyOnSubmission: true, notifyOnEscalation: true, notifyOnApproval: true, notifyOnRejection: true } }
  ]);

  console.log('Created default settings');

  const initiatorMaint = createdUsers.find(u => u.email === 'init.maint@company.com')!;
  const initiatorProd = createdUsers.find(u => u.email === 'init.prod@company.com')!;
  const initiatorAssembly = createdUsers.find(u => u.email === 'init.assembly@company.com')!;

  const mgrMaint = createdUsers.find(u => u.email === 'mgr.maint@company.com')!;
  const mgrProd = createdUsers.find(u => u.email === 'mgr.prod@company.com')!;
  const mgrAssembly = createdUsers.find(u => u.email === 'mgr.assembly@company.com')!;
  const mgrAdmin = createdUsers.find(u => u.email === 'mgr.admin@company.com')!;
  const mgrAccounts = createdUsers.find(u => u.email === 'mgr.accounts@company.com')!;

  const hodMaint = createdUsers.find(u => u.email === 'hod.maint@company.com')!;
  const hodProd = createdUsers.find(u => u.email === 'hod.prod@company.com')!;
  const hodAssembly = createdUsers.find(u => u.email === 'hod.assembly@company.com')!;
  const hodAdmin = createdUsers.find(u => u.email === 'hod.admin@company.com')!;
  const hodAccounts = createdUsers.find(u => u.email === 'hod.accounts@company.com')!;

  const agm = createdUsers.find(u => u.role === 'AGM')!;
  const gm = createdUsers.find(u => u.role === 'GM')!;

  const req1 = await db.insert(kaizenRequests).values({
    requestId: 'KZ-2025-001',
    title: 'Conveyor Belt Speed Optimization',
    stationName: 'Assembly Line A-12',
    issueDescription: 'Current belt speed causes bottleneck at station 3.',
    program: 'Model X Gen 2',
    customerPartNumber: 'MX-992-001',
    dateOfOrigination: '2025-12-01',
    department: 'PRODUCTION',
    initiatorId: initiatorProd.id,
    initiatorDepartmentId: deptMap.PRODUCTION,
    costEstimate: 35000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'PENDING_OWN_HOD',
    currentStage: 'OWN_HOD',
  }).returning();

  const req2 = await db.insert(kaizenRequests).values({
    requestId: 'KZ-2025-002',
    title: 'Drill Bit Cooling System',
    stationName: 'Machining Center 2',
    issueDescription: 'Overheating drill bits reduce lifespan by 40%.',
    program: 'Engine Block V6',
    customerPartNumber: 'EB-660-22',
    dateOfOrigination: '2025-12-02',
    department: 'MAINTENANCE',
    initiatorId: initiatorMaint.id,
    initiatorDepartmentId: deptMap.MAINTENANCE,
    costEstimate: 45000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'PENDING_CROSS_MANAGER',
    currentStage: 'CROSS_MANAGER',
  }).returning();

  await db.insert(kaizenHodApprovals).values({
    kaizenId: req2[0].id,
    hodUserId: hodMaint.id,
    departmentId: deptMap.MAINTENANCE,
    department: 'MAINTENANCE',
    decision: 'APPROVED',
    remarks: 'Approved by Maintenance HOD. Forwarding to managers.',
    stageType: 'OWN_HOD',
  });

  await db.insert(kaizenManagerApprovals).values([
    { kaizenId: req2[0].id, managerUserId: mgrProd.id, departmentId: deptMap.PRODUCTION, department: 'PRODUCTION', decision: 'APPROVED', remarks: 'No production impact.' },
    { kaizenId: req2[0].id, managerUserId: mgrAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Assembly approves.' },
  ]);

  const req2b = await db.insert(kaizenRequests).values({
    requestId: 'KZ-2025-002B',
    title: 'Tooling Cabinet Reorganization',
    stationName: 'Tool Crib',
    issueDescription: 'Disorganized cabinet delays tool retrieval.',
    program: 'All',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-12-05',
    department: 'PRODUCTION',
    initiatorId: initiatorProd.id,
    initiatorDepartmentId: deptMap.PRODUCTION,
    costEstimate: 30000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'PENDING_CROSS_HOD',
    currentStage: 'CROSS_HOD',
  }).returning();

  await db.insert(kaizenHodApprovals).values({
    kaizenId: req2b[0].id,
    hodUserId: hodProd.id,
    departmentId: deptMap.PRODUCTION,
    department: 'PRODUCTION',
    decision: 'APPROVED',
    remarks: 'Own dept approved.',
    stageType: 'OWN_HOD',
  });

  await db.insert(kaizenManagerApprovals).values([
    { kaizenId: req2b[0].id, managerUserId: mgrMaint.id, departmentId: deptMap.MAINTENANCE, department: 'MAINTENANCE', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req2b[0].id, managerUserId: mgrAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req2b[0].id, managerUserId: mgrAdmin.id, departmentId: deptMap.ADMIN, department: 'ADMIN', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req2b[0].id, managerUserId: mgrAccounts.id, departmentId: deptMap.ACCOUNTS, department: 'ACCOUNTS', decision: 'APPROVED', remarks: 'Approved.' },
  ]);

  await db.insert(kaizenHodApprovals).values([
    { kaizenId: req2b[0].id, hodUserId: hodMaint.id, departmentId: deptMap.MAINTENANCE, department: 'MAINTENANCE', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req2b[0].id, hodUserId: hodAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
  ]);

  const req3 = await db.insert(kaizenRequests).values({
    requestId: 'KZ-2025-003',
    title: 'Robotic Arm Installation',
    stationName: 'Welding Bay 4',
    issueDescription: 'Manual welding is inconsistent. Propose automation.',
    program: 'Heavy Truck Y',
    customerPartNumber: 'HT-WELD-04',
    dateOfOrigination: '2025-11-10',
    department: 'ASSEMBLY',
    initiatorId: initiatorAssembly.id,
    initiatorDepartmentId: deptMap.ASSEMBLY,
    costEstimate: 85000,
    requiresProcessAddition: true,
    requiresManpowerAddition: false,
    status: 'PENDING_AGM',
    currentStage: 'AGM',
  }).returning();

  await db.insert(kaizenHodApprovals).values([
    { kaizenId: req3[0].id, hodUserId: hodAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Own dept approved.', stageType: 'OWN_HOD' },
    { kaizenId: req3[0].id, hodUserId: hodMaint.id, departmentId: deptMap.MAINTENANCE, department: 'MAINTENANCE', decision: 'APPROVED', remarks: 'Maintenance approves.', stageType: 'CROSS_HOD' },
    { kaizenId: req3[0].id, hodUserId: hodProd.id, departmentId: deptMap.PRODUCTION, department: 'PRODUCTION', decision: 'APPROVED', remarks: 'Production approves.', stageType: 'CROSS_HOD' },
    { kaizenId: req3[0].id, hodUserId: hodAdmin.id, departmentId: deptMap.ADMIN, department: 'ADMIN', decision: 'APPROVED', remarks: 'Admin approves.', stageType: 'CROSS_HOD' },
    { kaizenId: req3[0].id, hodUserId: hodAccounts.id, departmentId: deptMap.ACCOUNTS, department: 'ACCOUNTS', decision: 'APPROVED', remarks: 'Accounts approves.', stageType: 'CROSS_HOD' },
  ]);

  await db.insert(kaizenManagerApprovals).values([
    { kaizenId: req3[0].id, managerUserId: mgrMaint.id, departmentId: deptMap.MAINTENANCE, department: 'MAINTENANCE', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req3[0].id, managerUserId: mgrProd.id, departmentId: deptMap.PRODUCTION, department: 'PRODUCTION', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req3[0].id, managerUserId: mgrAdmin.id, departmentId: deptMap.ADMIN, department: 'ADMIN', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req3[0].id, managerUserId: mgrAccounts.id, departmentId: deptMap.ACCOUNTS, department: 'ACCOUNTS', decision: 'APPROVED', remarks: 'Approved.' },
  ]);

  const req4 = await db.insert(kaizenRequests).values({
    requestId: 'KZ-2025-004',
    title: 'Paint Booth Line Expansion',
    stationName: 'Paint Shop',
    issueDescription: 'Capacity expansion required for new model.',
    program: 'Model Z',
    customerPartNumber: 'MZ-PNL-01',
    dateOfOrigination: '2025-10-01',
    department: 'PRODUCTION',
    initiatorId: initiatorProd.id,
    initiatorDepartmentId: deptMap.PRODUCTION,
    costEstimate: 150000,
    requiresProcessAddition: true,
    requiresManpowerAddition: true,
    status: 'PENDING_GM',
    currentStage: 'GM',
  }).returning();

  await db.insert(kaizenHodApprovals).values([
    { kaizenId: req4[0].id, hodUserId: hodProd.id, departmentId: deptMap.PRODUCTION, department: 'PRODUCTION', decision: 'APPROVED', remarks: 'Critical for capacity.', stageType: 'OWN_HOD' },
    { kaizenId: req4[0].id, hodUserId: hodMaint.id, departmentId: deptMap.MAINTENANCE, department: 'MAINTENANCE', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req4[0].id, hodUserId: hodAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req4[0].id, hodUserId: hodAdmin.id, departmentId: deptMap.ADMIN, department: 'ADMIN', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req4[0].id, hodUserId: hodAccounts.id, departmentId: deptMap.ACCOUNTS, department: 'ACCOUNTS', decision: 'APPROVED', remarks: 'Budget verified.', stageType: 'CROSS_HOD' },
  ]);

  await db.insert(kaizenManagerApprovals).values([
    { kaizenId: req4[0].id, managerUserId: mgrMaint.id, departmentId: deptMap.MAINTENANCE, department: 'MAINTENANCE', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req4[0].id, managerUserId: mgrAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req4[0].id, managerUserId: mgrAdmin.id, departmentId: deptMap.ADMIN, department: 'ADMIN', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req4[0].id, managerUserId: mgrAccounts.id, departmentId: deptMap.ACCOUNTS, department: 'ACCOUNTS', decision: 'APPROVED', remarks: 'Approved.' },
  ]);

  await db.insert(approvals).values({
    requestId: req4[0].id,
    approvalType: 'AGM',
    approvedBy: agm.id,
    approved: true,
    costJustification: 'ROI in 18 months.',
    comments: 'Approved by AGM.'
  });

  const req5 = await db.insert(kaizenRequests).values({
    requestId: 'KZ-2025-005',
    title: 'Safety Guard Installation',
    stationName: 'Press Shop',
    issueDescription: 'Missing guard on Press 3.',
    program: 'All',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-11-01',
    department: 'MAINTENANCE',
    initiatorId: initiatorMaint.id,
    initiatorDepartmentId: deptMap.MAINTENANCE,
    costEstimate: 25000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'APPROVED',
    currentStage: 'COMPLETED',
  }).returning();

  await db.insert(kaizenHodApprovals).values([
    { kaizenId: req5[0].id, hodUserId: hodMaint.id, departmentId: deptMap.MAINTENANCE, department: 'MAINTENANCE', decision: 'APPROVED', remarks: 'Safety priority.', stageType: 'OWN_HOD' },
    { kaizenId: req5[0].id, hodUserId: hodProd.id, departmentId: deptMap.PRODUCTION, department: 'PRODUCTION', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req5[0].id, hodUserId: hodAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req5[0].id, hodUserId: hodAdmin.id, departmentId: deptMap.ADMIN, department: 'ADMIN', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req5[0].id, hodUserId: hodAccounts.id, departmentId: deptMap.ACCOUNTS, department: 'ACCOUNTS', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
  ]);

  await db.insert(kaizenManagerApprovals).values([
    { kaizenId: req5[0].id, managerUserId: mgrProd.id, departmentId: deptMap.PRODUCTION, department: 'PRODUCTION', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req5[0].id, managerUserId: mgrAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req5[0].id, managerUserId: mgrAdmin.id, departmentId: deptMap.ADMIN, department: 'ADMIN', decision: 'APPROVED', remarks: 'Approved.' },
    { kaizenId: req5[0].id, managerUserId: mgrAccounts.id, departmentId: deptMap.ACCOUNTS, department: 'ACCOUNTS', decision: 'APPROVED', remarks: 'Approved.' },
  ]);

  await db.insert(approvals).values([
    { requestId: req5[0].id, approvalType: 'AGM', approvedBy: agm.id, approved: true, comments: 'Safety first.', costJustification: 'Safety compliance.' },
    { requestId: req5[0].id, approvalType: 'GM', approvedBy: gm.id, approved: true, comments: 'Final approved.', costJustification: 'Proceed immediately.' }
  ]);

  const req6 = await db.insert(kaizenRequests).values({
    requestId: 'KZ-2025-006',
    title: 'Redundant Tool Purchase',
    stationName: 'Assembly',
    issueDescription: 'Buy backup tools for each station.',
    program: 'Model X',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-12-08',
    department: 'PRODUCTION',
    initiatorId: initiatorProd.id,
    initiatorDepartmentId: deptMap.PRODUCTION,
    costEstimate: 45000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'OWN_HOD_REJECTED',
    rejectionReason: 'Rejected by Own HOD: Tools already available in central store.',
    rejectedBy: hodProd.id,
    rejectedByDepartment: 'PRODUCTION',
  }).returning();

  await db.insert(kaizenHodApprovals).values({
    kaizenId: req6[0].id,
    hodUserId: hodProd.id,
    departmentId: deptMap.PRODUCTION,
    department: 'PRODUCTION',
    decision: 'REJECTED',
    remarks: 'Tools already available in central store.',
    stageType: 'OWN_HOD',
  });

  const req7 = await db.insert(kaizenRequests).values({
    requestId: 'KZ-2025-007',
    title: 'Line 4 Layout Change',
    stationName: 'Line 4',
    issueDescription: 'Move machine to left side of line.',
    program: 'Model Z',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-11-25',
    department: 'ASSEMBLY',
    initiatorId: initiatorAssembly.id,
    initiatorDepartmentId: deptMap.ASSEMBLY,
    costEstimate: 60000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'CROSS_HOD_REJECTED',
    rejectionReason: 'Rejected by ADMIN HOD: Layout change would disrupt material flow.',
    rejectedBy: hodAdmin.id,
    rejectedByDepartment: 'ADMIN',
  }).returning();

  await db.insert(kaizenHodApprovals).values([
    { kaizenId: req7[0].id, hodUserId: hodAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Own dept approved.', stageType: 'OWN_HOD' },
    { kaizenId: req7[0].id, hodUserId: hodMaint.id, departmentId: deptMap.MAINTENANCE, department: 'MAINTENANCE', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req7[0].id, hodUserId: hodProd.id, departmentId: deptMap.PRODUCTION, department: 'PRODUCTION', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req7[0].id, hodUserId: hodAdmin.id, departmentId: deptMap.ADMIN, department: 'ADMIN', decision: 'REJECTED', remarks: 'Layout change would disrupt material flow.', stageType: 'CROSS_HOD' },
  ]);

  const req8 = await db.insert(kaizenRequests).values({
    requestId: 'KZ-2025-008',
    title: 'Luxury Break Room Renovation',
    stationName: 'Admin Building',
    issueDescription: 'Upgrade break room with premium furniture.',
    program: 'N/A',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-10-20',
    department: 'ADMIN',
    initiatorId: createdUsers.find(u => u.email === 'init.admin@company.com')!.id,
    initiatorDepartmentId: deptMap.ADMIN,
    costEstimate: 120000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'REJECTED',
    rejectionReason: 'Final rejection by GM: Not aligned with current budget priorities.',
    rejectedBy: gm.id,
  }).returning();

  await db.insert(kaizenHodApprovals).values([
    { kaizenId: req8[0].id, hodUserId: hodAdmin.id, departmentId: deptMap.ADMIN, department: 'ADMIN', decision: 'APPROVED', remarks: 'Good for morale.', stageType: 'OWN_HOD' },
    { kaizenId: req8[0].id, hodUserId: hodMaint.id, departmentId: deptMap.MAINTENANCE, department: 'MAINTENANCE', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req8[0].id, hodUserId: hodProd.id, departmentId: deptMap.PRODUCTION, department: 'PRODUCTION', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req8[0].id, hodUserId: hodAssembly.id, departmentId: deptMap.ASSEMBLY, department: 'ASSEMBLY', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
    { kaizenId: req8[0].id, hodUserId: hodAccounts.id, departmentId: deptMap.ACCOUNTS, department: 'ACCOUNTS', decision: 'APPROVED', remarks: 'Approved.', stageType: 'CROSS_HOD' },
  ]);

  await db.insert(approvals).values([
    { requestId: req8[0].id, approvalType: 'AGM', approvedBy: agm.id, approved: true, comments: 'Employee satisfaction.', costJustification: 'Morale boost.' },
    { requestId: req8[0].id, approvalType: 'GM', approvedBy: gm.id, approved: false, comments: 'Not aligned with current budget priorities.', costJustification: 'Defer to next FY.' }
  ]);

  console.log('Created 8 sample kaizen requests with various statuses');
  console.log('Seed completed successfully!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
