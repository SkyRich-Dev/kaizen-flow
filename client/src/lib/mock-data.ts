import { KaizenRequest, CFTAssessment } from './types';

const defaultRiskFactors = { 
  safety: 'Low', 
  productivity: 'Neutral', 
  manpower: 'None', 
  ergonomics: 'Neutral', 
  training: 'None', 
  cost: 'Low', 
  quality: 'Neutral' 
};

// Helper to create completed CFT assessments
const createCFTAssessments = (status: 'ACCEPTED' | 'REJECTED' = 'ACCEPTED'): CFTAssessment[] => {
  const depts = ['MAINTENANCE', 'PRODUCTION', 'QUALITY', 'MANUFACTURING'] as const;
  return depts.map((d, i) => ({
    department: d,
    assessedBy: `u${i + 2}`,
    assessedAt: new Date(Date.now() - 86400000 * (4 - i)).toISOString(),
    status,
    riskFactors: defaultRiskFactors,
    comments: status === 'ACCEPTED' ? 'Risk within acceptable limits.' : 'Significant risk identified.'
  }));
};

export const MOCK_REQUESTS: KaizenRequest[] = [
  // 1. DRAFT / PENDING CFT (New Request)
  {
    id: 'KZ-2025-001',
    title: 'Conveyor Belt Speed Optimization',
    stationName: 'Assembly Line A-12',
    issueDescription: 'Current belt speed causes bottleneck at station 3 due to manual alignment requirement.',
    program: 'Model X Gen 2',
    customerPartNumber: 'MX-992-001',
    dateOfOrigination: '2025-12-01',
    department: 'PRODUCTION',
    initiatorId: 'u1',
    createdAt: '2025-12-01T09:00:00Z',
    costEstimate: 12000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'PENDING_CFT',
    cftAssessments: [],
    attachments: [
      { name: 'process_flow.pdf', url: '#', uploadedAt: '2025-12-01T09:00:00Z' }
    ]
  },

  // 2. PARTIAL CFT (Some depts assessed)
  {
    id: 'KZ-2025-002',
    title: 'Drill Bit Cooling System',
    stationName: 'Machining Center 2',
    issueDescription: 'Overheating drill bits reduce lifespan by 40%. Proposing new coolant nozzle.',
    program: 'Engine Block V6',
    customerPartNumber: 'EB-660-22',
    dateOfOrigination: '2025-12-02',
    department: 'MAINTENANCE',
    initiatorId: 'u1',
    createdAt: '2025-12-02T10:00:00Z',
    costEstimate: 4500,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'PENDING_CFT',
    cftAssessments: [
      {
        department: 'MAINTENANCE',
        assessedBy: 'u2',
        assessedAt: '2025-12-03T09:00:00Z',
        status: 'ACCEPTED',
        riskFactors: { ...defaultRiskFactors, productivity: 'High' },
        comments: 'Will reduce downtime.'
      },
      {
        department: 'QUALITY',
        assessedBy: 'u3',
        assessedAt: '2025-12-03T11:00:00Z',
        status: 'ACCEPTED',
        riskFactors: { ...defaultRiskFactors, quality: 'High' },
        comments: 'Better surface finish expected.'
      }
    ],
    attachments: []
  },

  // 3. PENDING HOD (CFT Complete, Low Cost)
  {
    id: 'KZ-2025-003',
    title: 'Ergonomic Mat Replacement',
    stationName: 'All Packing Stations',
    issueDescription: 'Current mats are worn out, causing operator fatigue.',
    program: 'Global',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-11-20',
    department: 'PRODUCTION',
    initiatorId: 'u1',
    createdAt: '2025-11-20T08:00:00Z',
    costEstimate: 25000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'PENDING_HOD',
    cftAssessments: createCFTAssessments('ACCEPTED'),
    attachments: []
  },

  // 4. PENDING AGM (Medium Cost: 50k-100k)
  {
    id: 'KZ-2025-004',
    title: 'New Robotic Arm Installation',
    stationName: 'Welding Bay 4',
    issueDescription: 'Manual welding is inconsistent. Propose automation.',
    program: 'Heavy Truck Y',
    customerPartNumber: 'HT-WELD-04',
    dateOfOrigination: '2025-11-10',
    department: 'MANUFACTURING',
    initiatorId: 'u1',
    createdAt: '2025-11-10T14:30:00Z',
    costEstimate: 85000,
    requiresProcessAddition: true,
    requiresManpowerAddition: false,
    status: 'PENDING_AGM',
    cftAssessments: createCFTAssessments('ACCEPTED'),
    hodApproval: {
      approved: true,
      approvedBy: 'u6',
      approvedAt: '2025-11-15T09:00:00Z',
      comments: 'Approved. Escalating to AGM due to cost > 50k.'
    },
    attachments: []
  },

  // 5. PENDING GM (High Cost: >100k)
  {
    id: 'KZ-2025-005',
    title: 'New Paint Booth Line Expansion',
    stationName: 'Paint Shop',
    issueDescription: 'Capacity expansion required for new model.',
    program: 'Model Z',
    customerPartNumber: 'MZ-PNL-01',
    dateOfOrigination: '2025-10-01',
    department: 'MANUFACTURING',
    initiatorId: 'u1',
    createdAt: '2025-10-01T09:00:00Z',
    costEstimate: 150000,
    requiresProcessAddition: true,
    requiresManpowerAddition: true,
    status: 'PENDING_GM',
    cftAssessments: createCFTAssessments('ACCEPTED'),
    hodApproval: {
      approved: true,
      approvedBy: 'u6',
      approvedAt: '2025-10-05T09:00:00Z',
      comments: 'Critical expansion.'
    },
    agmApproval: {
      approved: true,
      approvedBy: 'u7',
      approvedAt: '2025-10-06T09:00:00Z',
      costJustification: 'ROI in 18 months.',
      comments: 'Approved.'
    },
    attachments: []
  },

  // 6. APPROVED (Low Cost, HOD Only)
  {
    id: 'KZ-2025-006',
    title: 'Safety Guard Installation',
    stationName: 'Press Shop',
    issueDescription: 'Missing guard on Press 3.',
    program: 'All',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-11-01',
    department: 'MAINTENANCE',
    initiatorId: 'u1',
    createdAt: '2025-11-01T09:00:00Z',
    costEstimate: 15000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'APPROVED',
    cftAssessments: createCFTAssessments('ACCEPTED'),
    hodApproval: {
      approved: true,
      approvedBy: 'u6',
      approvedAt: '2025-11-05T09:00:00Z',
      comments: 'Approved. Proceed immediately.'
    },
    attachments: []
  },

  // 7. APPROVED (High Cost, GM Approved)
  {
    id: 'KZ-2025-007',
    title: 'Warehouse Automation System',
    stationName: 'Logistics',
    issueDescription: 'Full automation of pallet retrieval.',
    program: 'Global',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-09-01',
    department: 'PRODUCTION',
    initiatorId: 'u1',
    createdAt: '2025-09-01T09:00:00Z',
    costEstimate: 250000,
    requiresProcessAddition: true,
    requiresManpowerAddition: false,
    status: 'APPROVED',
    cftAssessments: createCFTAssessments('ACCEPTED'),
    hodApproval: { approved: true, approvedBy: 'u6', approvedAt: '2025-09-05T09:00:00Z', comments: 'Strategic investment.' },
    agmApproval: { approved: true, approvedBy: 'u7', approvedAt: '2025-09-07T09:00:00Z', costJustification: 'Labor saving.', comments: 'Approved.' },
    gmApproval: { approved: true, approvedBy: 'u8', approvedAt: '2025-09-10T09:00:00Z', costJustification: 'Approved per budget.', comments: 'Execute in Q4.' },
    attachments: []
  },

  // 8. REJECTED by CFT
  {
    id: 'KZ-2025-008',
    title: 'Unproven Chemical Substitute',
    stationName: 'Cleaning Bay',
    issueDescription: 'Replace cleaner A with cheaper B.',
    program: 'Model Y',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-12-05',
    department: 'QUALITY',
    initiatorId: 'u1',
    createdAt: '2025-12-05T09:00:00Z',
    costEstimate: 500,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'REJECTED',
    rejectionReason: 'Rejected by CFT (QUALITY): Chemical B causes corrosion.',
    cftAssessments: [
      {
        department: 'MAINTENANCE',
        assessedBy: 'u2',
        assessedAt: '2025-12-06T09:00:00Z',
        status: 'ACCEPTED',
        riskFactors: defaultRiskFactors,
        comments: 'No impact on equipment.'
      },
      {
        department: 'QUALITY',
        assessedBy: 'u3',
        assessedAt: '2025-12-06T10:00:00Z',
        status: 'REJECTED',
        riskFactors: { ...defaultRiskFactors, quality: 'High', safety: 'High' },
        comments: 'Chemical B causes corrosion.'
      }
    ],
    attachments: []
  },

  // 9. REJECTED by HOD
  {
    id: 'KZ-2025-009',
    title: 'Redundant Tool Purchase',
    stationName: 'Assembly',
    issueDescription: 'Buy backup tools.',
    program: 'Model X',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-12-08',
    department: 'PRODUCTION',
    initiatorId: 'u1',
    createdAt: '2025-12-08T09:00:00Z',
    costEstimate: 45000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'REJECTED',
    rejectionReason: 'Rejected by HOD: Tools already available in store.',
    cftAssessments: createCFTAssessments('ACCEPTED'),
    hodApproval: {
      approved: false,
      approvedBy: 'u6',
      approvedAt: '2025-12-10T09:00:00Z',
      comments: 'Tools already available in store.'
    },
    attachments: []
  },

  // 10. REJECTED by AGM
  {
    id: 'KZ-2025-010',
    title: 'Layout Change',
    stationName: 'Line 4',
    issueDescription: 'Move machine to left.',
    program: 'Model Z',
    customerPartNumber: 'N/A',
    dateOfOrigination: '2025-11-25',
    department: 'MANUFACTURING',
    initiatorId: 'u1',
    createdAt: '2025-11-25T09:00:00Z',
    costEstimate: 60000,
    requiresProcessAddition: false,
    requiresManpowerAddition: false,
    status: 'REJECTED',
    rejectionReason: 'Rejected by AGM: Disrupts flow.',
    cftAssessments: createCFTAssessments('ACCEPTED'),
    hodApproval: { approved: true, approvedBy: 'u6', approvedAt: '2025-11-28T09:00:00Z', comments: 'Approved.' },
    agmApproval: {
      approved: false,
      approvedBy: 'u7',
      approvedAt: '2025-11-30T09:00:00Z',
      costJustification: 'N/A',
      comments: 'Disrupts flow.'
    },
    attachments: []
  }
];
