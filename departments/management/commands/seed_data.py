from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import json
from departments.models import Department, EvaluationQuestion
from accounts.models import User
from kaizen_requests.models import KaizenRequest
from approvals.models import ManagerApproval, HodApproval, AgmApproval, GmApproval, DepartmentEvaluation
from audit.models import AuditLog, Setting


DEPARTMENTS_DATA = [
    ('MAINTENANCE', 'Maintenance'),
    ('PRODUCTION', 'Production'),
    ('ASSEMBLY', 'Assembly'),
    ('ADMIN', 'Admin'),
    ('ACCOUNTS', 'Accounts'),
]

EVALUATION_QUESTIONS = {
    'MAINTENANCE': [
        ('maint.q1', 'Is the equipment properly maintained and serviced?'),
        ('maint.q2', 'Are all safety guards and covers in place?'),
        ('maint.q3', 'Is preventive maintenance schedule being followed?'),
        ('maint.q4', 'Are spare parts available for critical equipment?'),
        ('maint.q5', 'Is the maintenance log updated regularly?'),
        ('maint.q6', 'Are breakdown patterns analyzed for root causes?'),
        ('maint.q7', 'Is there adequate training for maintenance staff?'),
    ],
    'PRODUCTION': [
        ('prod.q1', 'Will this change affect production capacity?'),
        ('prod.q2', 'Is the change compatible with current production line?'),
        ('prod.q3', 'Will there be any downtime during implementation?'),
        ('prod.q4', 'Are production targets achievable after implementation?'),
        ('prod.q5', 'Is the change documented for production procedures?'),
    ],
    'ASSEMBLY': [
        ('assy.q1', 'Does this change affect assembly process flow?'),
        ('assy.q2', 'Is worker safety impacted by this change?'),
        ('assy.q3', 'Are assembly instructions updated?'),
        ('assy.q4', 'Will this require additional training for assembly workers?'),
        ('assy.q5', 'Is the change compatible with existing assembly tools?'),
        ('assy.q6', 'Will cycle time be affected?'),
    ],
    'ADMIN': [
        ('admin.q1', 'Is the change compliant with company policies?'),
        ('admin.q2', 'Are all necessary approvals in place?'),
        ('admin.q3', 'Is documentation properly archived?'),
        ('admin.q4', 'Are stakeholders informed of the change?'),
    ],
    'ACCOUNTS': [
        ('acct.q1', 'Is the budget approved for this change?'),
        ('acct.q2', 'Are vendor payments scheduled?'),
        ('acct.q3', 'Is cost tracking set up for this project?'),
        ('acct.q4', 'Are financial risks documented?'),
        ('acct.q5', 'Is ROI calculation complete?'),
    ],
}

SAMPLE_USERS = [
    # Maintenance Department
    {'username': 'john.smith', 'email': 'john.smith@example.com', 'first_name': 'John', 'last_name': 'Smith', 
     'role': 'INITIATOR', 'department': 'MAINTENANCE', 'password': 'password123'},
    {'username': 'mike.manager', 'email': 'mike.manager@example.com', 'first_name': 'Mike', 'last_name': 'Manager', 
     'role': 'MANAGER', 'department': 'MAINTENANCE', 'password': 'password123', 'is_manager': True},
    {'username': 'helen.hod', 'email': 'helen.hod@example.com', 'first_name': 'Helen', 'last_name': 'Henderson', 
     'role': 'HOD', 'department': 'MAINTENANCE', 'password': 'password123', 'is_hod': True},
    
    # Production Department
    {'username': 'paul.producer', 'email': 'paul.producer@example.com', 'first_name': 'Paul', 'last_name': 'Producer', 
     'role': 'INITIATOR', 'department': 'PRODUCTION', 'password': 'password123'},
    {'username': 'mary.manager', 'email': 'mary.manager@example.com', 'first_name': 'Mary', 'last_name': 'Martinez', 
     'role': 'MANAGER', 'department': 'PRODUCTION', 'password': 'password123', 'is_manager': True},
    {'username': 'peter.hod', 'email': 'peter.hod@example.com', 'first_name': 'Peter', 'last_name': 'Peterson', 
     'role': 'HOD', 'department': 'PRODUCTION', 'password': 'password123', 'is_hod': True},
    
    # Assembly Department
    {'username': 'alex.assembler', 'email': 'alex.assembler@example.com', 'first_name': 'Alex', 'last_name': 'Anderson', 
     'role': 'INITIATOR', 'department': 'ASSEMBLY', 'password': 'password123'},
    {'username': 'sara.manager', 'email': 'sara.manager@example.com', 'first_name': 'Sara', 'last_name': 'Singh', 
     'role': 'MANAGER', 'department': 'ASSEMBLY', 'password': 'password123', 'is_manager': True},
    {'username': 'alan.hod', 'email': 'alan.hod@example.com', 'first_name': 'Alan', 'last_name': 'Adams', 
     'role': 'HOD', 'department': 'ASSEMBLY', 'password': 'password123', 'is_hod': True},
    
    # Admin Department
    {'username': 'david.admin', 'email': 'david.admin@example.com', 'first_name': 'David', 'last_name': 'Davis', 
     'role': 'INITIATOR', 'department': 'ADMIN', 'password': 'password123'},
    {'username': 'diana.manager', 'email': 'diana.manager@example.com', 'first_name': 'Diana', 'last_name': 'Diaz', 
     'role': 'MANAGER', 'department': 'ADMIN', 'password': 'password123', 'is_manager': True},
    {'username': 'derek.hod', 'email': 'derek.hod@example.com', 'first_name': 'Derek', 'last_name': 'Dean', 
     'role': 'HOD', 'department': 'ADMIN', 'password': 'password123', 'is_hod': True},
    
    # Accounts Department
    {'username': 'anna.accountant', 'email': 'anna.accountant@example.com', 'first_name': 'Anna', 'last_name': 'Andrews', 
     'role': 'INITIATOR', 'department': 'ACCOUNTS', 'password': 'password123'},
    {'username': 'bob.manager', 'email': 'bob.manager@example.com', 'first_name': 'Bob', 'last_name': 'Brown', 
     'role': 'MANAGER', 'department': 'ACCOUNTS', 'password': 'password123', 'is_manager': True},
    {'username': 'betty.hod', 'email': 'betty.hod@example.com', 'first_name': 'Betty', 'last_name': 'Barnes', 
     'role': 'HOD', 'department': 'ACCOUNTS', 'password': 'password123', 'is_hod': True},
    
    # Senior Management
    {'username': 'agm.sharma', 'email': 'agm.sharma@example.com', 'first_name': 'Rajesh', 'last_name': 'Sharma', 
     'role': 'AGM', 'department': 'ADMIN', 'password': 'password123'},
    {'username': 'gm.gupta', 'email': 'gm.gupta@example.com', 'first_name': 'Vikram', 'last_name': 'Gupta', 
     'role': 'GM', 'department': 'ADMIN', 'password': 'password123'},
]

# 50 comprehensive test requests covering all statuses and scenarios
SAMPLE_REQUESTS = [
    # === DRAFT STATUS (5 requests) ===
    {'title': 'Draft: Laser Cutting Machine Upgrade', 'station_name': 'Cutting Station 1', 'assembly_line': 'Line A',
     'issue_description': 'Current laser cutter has limited precision for new designs.',
     'poka_yoke_description': 'Auto-focus and material detection.', 'reason_for_implementation': 'Enable new product designs.',
     'program': 'Multi-Program', 'customer_part_number': 'MP-DRAFT-001', 'cost_estimate': Decimal('45000'),
     'department': 'MAINTENANCE', 'status': 'DRAFT', 'current_stage': 'DRAFT'},
    {'title': 'Draft: Workbench Lighting Improvement', 'station_name': 'Assembly Station 5', 'assembly_line': 'Line B',
     'issue_description': 'Insufficient lighting causes eye strain.', 'poka_yoke_description': 'Motion-activated LED lights.',
     'reason_for_implementation': 'Improve worker comfort and accuracy.', 'program': 'All Programs',
     'customer_part_number': 'ALL-DRAFT-002', 'cost_estimate': Decimal('12000'), 'department': 'PRODUCTION',
     'status': 'DRAFT', 'current_stage': 'DRAFT'},
    {'title': 'Draft: Air Compressor Replacement', 'station_name': 'Utility Room', 'assembly_line': 'N/A',
     'issue_description': 'Old compressor is inefficient and noisy.', 'poka_yoke_description': 'Pressure monitoring system.',
     'reason_for_implementation': 'Reduce energy costs.', 'program': 'Multi-Program', 'customer_part_number': 'MP-DRAFT-003',
     'cost_estimate': Decimal('85000'), 'department': 'ASSEMBLY', 'status': 'DRAFT', 'current_stage': 'DRAFT'},
    {'title': 'Draft: Document Scanner Installation', 'station_name': 'Admin Office', 'assembly_line': 'N/A',
     'issue_description': 'Manual document handling is slow.', 'poka_yoke_description': 'Auto-feed with jam detection.',
     'reason_for_implementation': 'Speed up document processing.', 'program': 'Admin', 'customer_part_number': 'ADM-DRAFT-004',
     'cost_estimate': Decimal('8000'), 'department': 'ADMIN', 'status': 'DRAFT', 'current_stage': 'DRAFT'},
    {'title': 'Draft: Invoice Processing Software', 'station_name': 'Accounts Office', 'assembly_line': 'N/A',
     'issue_description': 'Manual invoice entry is error-prone.', 'poka_yoke_description': 'OCR with validation.',
     'reason_for_implementation': 'Reduce errors and speed.', 'program': 'Finance', 'customer_part_number': 'FIN-DRAFT-005',
     'cost_estimate': Decimal('35000'), 'department': 'ACCOUNTS', 'status': 'DRAFT', 'current_stage': 'DRAFT'},

    # === PENDING_OWN_MANAGER STATUS (5 requests per department = 25 requests) ===
    # Maintenance - Pending Own Manager
    {'title': 'PM01: CNC Tool Changer Automation', 'station_name': 'CNC Station 1', 'assembly_line': 'Line A',
     'issue_description': 'Manual tool change takes 15 minutes.', 'poka_yoke_description': 'Sensor-based tool detection.',
     'reason_for_implementation': 'Reduce downtime.', 'program': 'Toyota Innova', 'customer_part_number': 'TI-PM01',
     'cost_estimate': Decimal('48000'), 'department': 'MAINTENANCE', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},
    {'title': 'PM02: Hydraulic Press Safety Upgrade', 'station_name': 'Press Station 2', 'assembly_line': 'Line B',
     'issue_description': 'Need two-hand operation for safety.', 'poka_yoke_description': 'Dual palm button system.',
     'reason_for_implementation': 'Improve operator safety.', 'program': 'Honda City', 'customer_part_number': 'HC-PM02',
     'cost_estimate': Decimal('22000'), 'department': 'MAINTENANCE', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},
    # Production - Pending Own Manager
    {'title': 'PM03: Conveyor Speed Controller', 'station_name': 'Main Conveyor', 'assembly_line': 'Line A',
     'issue_description': 'Fixed speed causes bottlenecks.', 'poka_yoke_description': 'Variable speed with sensors.',
     'reason_for_implementation': 'Optimize flow.', 'program': 'Maruti Swift', 'customer_part_number': 'MS-PM03',
     'cost_estimate': Decimal('38000'), 'department': 'PRODUCTION', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},
    {'title': 'PM04: Quality Camera System', 'station_name': 'QC Station 1', 'assembly_line': 'Line C',
     'issue_description': 'Visual inspection is inconsistent.', 'poka_yoke_description': 'AI-based defect detection.',
     'reason_for_implementation': 'Improve quality.', 'program': 'Tata Nexon', 'customer_part_number': 'TN-PM04',
     'cost_estimate': Decimal('65000'), 'department': 'PRODUCTION', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},
    # Assembly - Pending Own Manager
    {'title': 'PM05: Torque Wrench Upgrade', 'station_name': 'Fastening Station 1', 'assembly_line': 'Line A',
     'issue_description': 'Manual torque verification is slow.', 'poka_yoke_description': 'Digital torque with logging.',
     'reason_for_implementation': 'Ensure proper fastening.', 'program': 'BMW X1', 'customer_part_number': 'BX1-PM05',
     'cost_estimate': Decimal('55000'), 'department': 'ASSEMBLY', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},
    {'title': 'PM06: Parts Bin Organization', 'station_name': 'Assembly Station 8', 'assembly_line': 'Line B',
     'issue_description': 'Parts mixing causes errors.', 'poka_yoke_description': 'Color-coded with RFID.',
     'reason_for_implementation': 'Reduce assembly errors.', 'program': 'Hyundai Creta', 'customer_part_number': 'HC-PM06',
     'cost_estimate': Decimal('18000'), 'department': 'ASSEMBLY', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},
    # Admin - Pending Own Manager
    {'title': 'PM07: Visitor Management System', 'station_name': 'Reception', 'assembly_line': 'N/A',
     'issue_description': 'Manual visitor log is inefficient.', 'poka_yoke_description': 'Digital check-in with badges.',
     'reason_for_implementation': 'Improve security tracking.', 'program': 'Admin', 'customer_part_number': 'ADM-PM07',
     'cost_estimate': Decimal('25000'), 'department': 'ADMIN', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},
    {'title': 'PM08: Meeting Room Booking System', 'station_name': 'Conference Rooms', 'assembly_line': 'N/A',
     'issue_description': 'Double bookings are common.', 'poka_yoke_description': 'Real-time availability display.',
     'reason_for_implementation': 'Improve scheduling.', 'program': 'Admin', 'customer_part_number': 'ADM-PM08',
     'cost_estimate': Decimal('15000'), 'department': 'ADMIN', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},
    # Accounts - Pending Own Manager
    {'title': 'PM09: Expense Tracking App', 'station_name': 'Finance Office', 'assembly_line': 'N/A',
     'issue_description': 'Paper receipts are lost.', 'poka_yoke_description': 'Mobile app with OCR.',
     'reason_for_implementation': 'Simplify expense claims.', 'program': 'Finance', 'customer_part_number': 'FIN-PM09',
     'cost_estimate': Decimal('28000'), 'department': 'ACCOUNTS', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},
    {'title': 'PM10: Budget Dashboard', 'station_name': 'Finance Office', 'assembly_line': 'N/A',
     'issue_description': 'Budget tracking is manual.', 'poka_yoke_description': 'Real-time budget alerts.',
     'reason_for_implementation': 'Better financial visibility.', 'program': 'Finance', 'customer_part_number': 'FIN-PM10',
     'cost_estimate': Decimal('42000'), 'department': 'ACCOUNTS', 'status': 'PENDING_OWN_MANAGER', 'current_stage': 'OWN_MANAGER'},

    # === PENDING_OWN_HOD STATUS (5 requests) ===
    {'title': 'POH01: Welding Fume Extractor', 'station_name': 'Welding Bay 1', 'assembly_line': 'Line A',
     'issue_description': 'Welding fumes exceed limits.', 'poka_yoke_description': 'Auto-start with welder activation.',
     'reason_for_implementation': 'Worker health.', 'program': 'Multi-Program', 'customer_part_number': 'MP-POH01',
     'cost_estimate': Decimal('35000'), 'department': 'MAINTENANCE', 'status': 'PENDING_OWN_HOD', 'current_stage': 'OWN_HOD'},
    {'title': 'POH02: Assembly Line Balancing', 'station_name': 'Line B', 'assembly_line': 'Line B',
     'issue_description': 'Uneven workload distribution.', 'poka_yoke_description': 'Workload monitoring display.',
     'reason_for_implementation': 'Improve efficiency.', 'program': 'Honda City', 'customer_part_number': 'HC-POH02',
     'cost_estimate': Decimal('28000'), 'department': 'PRODUCTION', 'status': 'PENDING_OWN_HOD', 'current_stage': 'OWN_HOD'},
    {'title': 'POH03: Ergonomic Tool Holders', 'station_name': 'Assembly Stations', 'assembly_line': 'Line C',
     'issue_description': 'Tools not within easy reach.', 'poka_yoke_description': 'Magnetic holders at optimal height.',
     'reason_for_implementation': 'Reduce strain.', 'program': 'All Programs', 'customer_part_number': 'ALL-POH03',
     'cost_estimate': Decimal('15000'), 'department': 'ASSEMBLY', 'status': 'PENDING_OWN_HOD', 'current_stage': 'OWN_HOD'},
    {'title': 'POH04: Training Room AV Upgrade', 'station_name': 'Training Room', 'assembly_line': 'N/A',
     'issue_description': 'Old projector is dim.', 'poka_yoke_description': 'Auto-focus and wireless connection.',
     'reason_for_implementation': 'Better training experience.', 'program': 'Admin', 'customer_part_number': 'ADM-POH04',
     'cost_estimate': Decimal('45000'), 'department': 'ADMIN', 'status': 'PENDING_OWN_HOD', 'current_stage': 'OWN_HOD'},
    {'title': 'POH05: Payroll System Update', 'station_name': 'HR Office', 'assembly_line': 'N/A',
     'issue_description': 'Current system lacks features.', 'poka_yoke_description': 'Automatic tax calculations.',
     'reason_for_implementation': 'Compliance and efficiency.', 'program': 'Finance', 'customer_part_number': 'FIN-POH05',
     'cost_estimate': Decimal('55000'), 'department': 'ACCOUNTS', 'status': 'PENDING_OWN_HOD', 'current_stage': 'OWN_HOD'},

    # === PENDING_CROSS_MANAGER STATUS (5 requests) ===
    {'title': 'PCM01: Robot Cell Safety Fence', 'station_name': 'Robot Cell 1', 'assembly_line': 'Line A',
     'issue_description': 'Need light curtain safety.', 'poka_yoke_description': 'Light curtain with auto-stop.',
     'reason_for_implementation': 'Safety compliance.', 'program': 'Multi-Program', 'customer_part_number': 'MP-PCM01',
     'cost_estimate': Decimal('72000'), 'department': 'MAINTENANCE', 'status': 'PENDING_CROSS_MANAGER', 'current_stage': 'CROSS_MANAGER'},
    {'title': 'PCM02: Batch Tracking System', 'station_name': 'All Stations', 'assembly_line': 'All Lines',
     'issue_description': 'Traceability is manual.', 'poka_yoke_description': 'Barcode scanning at each station.',
     'reason_for_implementation': 'Quality traceability.', 'program': 'All Programs', 'customer_part_number': 'ALL-PCM02',
     'cost_estimate': Decimal('88000'), 'department': 'PRODUCTION', 'status': 'PENDING_CROSS_MANAGER', 'current_stage': 'CROSS_MANAGER'},
    {'title': 'PCM03: Pneumatic Tool Upgrade', 'station_name': 'Fastening Stations', 'assembly_line': 'Line B',
     'issue_description': 'Old tools have vibration issues.', 'poka_yoke_description': 'Anti-vibration with counters.',
     'reason_for_implementation': 'Worker health.', 'program': 'BMW X1', 'customer_part_number': 'BX1-PCM03',
     'cost_estimate': Decimal('62000'), 'department': 'ASSEMBLY', 'status': 'PENDING_CROSS_MANAGER', 'current_stage': 'CROSS_MANAGER'},
    {'title': 'PCM04: Access Control Upgrade', 'station_name': 'All Entry Points', 'assembly_line': 'N/A',
     'issue_description': 'Old card readers failing.', 'poka_yoke_description': 'Biometric with card backup.',
     'reason_for_implementation': 'Security improvement.', 'program': 'Admin', 'customer_part_number': 'ADM-PCM04',
     'cost_estimate': Decimal('95000'), 'department': 'ADMIN', 'status': 'PENDING_CROSS_MANAGER', 'current_stage': 'CROSS_MANAGER'},
    {'title': 'PCM05: Inventory Management System', 'station_name': 'Warehouse', 'assembly_line': 'N/A',
     'issue_description': 'Stock levels often wrong.', 'poka_yoke_description': 'Real-time tracking with alerts.',
     'reason_for_implementation': 'Accurate inventory.', 'program': 'All Programs', 'customer_part_number': 'ALL-PCM05',
     'cost_estimate': Decimal('78000'), 'department': 'ACCOUNTS', 'status': 'PENDING_CROSS_MANAGER', 'current_stage': 'CROSS_MANAGER'},

    # === PENDING_CROSS_HOD STATUS (5 requests) ===
    {'title': 'PCH01: Predictive Maintenance IoT', 'station_name': 'Critical Equipment', 'assembly_line': 'All Lines',
     'issue_description': 'Unexpected breakdowns.', 'poka_yoke_description': 'Vibration and temp sensors.',
     'reason_for_implementation': 'Prevent failures.', 'program': 'Multi-Program', 'customer_part_number': 'MP-PCH01',
     'cost_estimate': Decimal('110000'), 'department': 'MAINTENANCE', 'status': 'PENDING_CROSS_HOD', 'current_stage': 'CROSS_HOD'},
    {'title': 'PCH02: Automated Testing Rig', 'station_name': 'Test Station', 'assembly_line': 'Line A',
     'issue_description': 'Manual testing is slow.', 'poka_yoke_description': 'Automated test sequence.',
     'reason_for_implementation': 'Faster testing.', 'program': 'Toyota Innova', 'customer_part_number': 'TI-PCH02',
     'cost_estimate': Decimal('95000'), 'department': 'PRODUCTION', 'status': 'PENDING_CROSS_HOD', 'current_stage': 'CROSS_HOD'},
    {'title': 'PCH03: Wire Harness Tester', 'station_name': 'Harness Station', 'assembly_line': 'Line C',
     'issue_description': 'Manual continuity test.', 'poka_yoke_description': 'Automatic pinout testing.',
     'reason_for_implementation': 'Detect wiring errors.', 'program': 'Hyundai Creta', 'customer_part_number': 'HC-PCH03',
     'cost_estimate': Decimal('68000'), 'department': 'ASSEMBLY', 'status': 'PENDING_CROSS_HOD', 'current_stage': 'CROSS_HOD'},
    {'title': 'PCH04: Energy Monitoring System', 'station_name': 'Utility Area', 'assembly_line': 'N/A',
     'issue_description': 'No visibility into energy use.', 'poka_yoke_description': 'Smart meters with dashboard.',
     'reason_for_implementation': 'Reduce energy costs.', 'program': 'Admin', 'customer_part_number': 'ADM-PCH04',
     'cost_estimate': Decimal('85000'), 'department': 'ADMIN', 'status': 'PENDING_CROSS_HOD', 'current_stage': 'CROSS_HOD'},
    {'title': 'PCH05: Vendor Portal System', 'station_name': 'Procurement', 'assembly_line': 'N/A',
     'issue_description': 'Manual PO process.', 'poka_yoke_description': 'Online ordering with approvals.',
     'reason_for_implementation': 'Streamline procurement.', 'program': 'Finance', 'customer_part_number': 'FIN-PCH05',
     'cost_estimate': Decimal('72000'), 'department': 'ACCOUNTS', 'status': 'PENDING_CROSS_HOD', 'current_stage': 'CROSS_HOD'},

    # === PENDING_AGM STATUS (5 requests) ===
    {'title': 'AGM01: High-Speed CNC Upgrade', 'station_name': 'Machining Center', 'assembly_line': 'Line A',
     'issue_description': 'Current CNC too slow.', 'poka_yoke_description': 'Collision detection system.',
     'reason_for_implementation': 'Increase capacity.', 'program': 'Multi-Program', 'customer_part_number': 'MP-AGM01',
     'cost_estimate': Decimal('180000'), 'department': 'MAINTENANCE', 'status': 'PENDING_AGM', 'current_stage': 'AGM'},
    {'title': 'AGM02: Paint Booth Upgrade', 'station_name': 'Paint Booth 1', 'assembly_line': 'Line B',
     'issue_description': 'Need better finish quality.', 'poka_yoke_description': 'Humidity and temp control.',
     'reason_for_implementation': 'Quality improvement.', 'program': 'BMW X1', 'customer_part_number': 'BX1-AGM02',
     'cost_estimate': Decimal('220000'), 'department': 'PRODUCTION', 'status': 'PENDING_AGM', 'current_stage': 'AGM',
     'requires_process_addition': True},
    {'title': 'AGM03: Robotic Assembly Cell', 'station_name': 'New Robot Cell', 'assembly_line': 'Line C',
     'issue_description': 'Manual assembly is bottleneck.', 'poka_yoke_description': 'Vision-guided assembly.',
     'reason_for_implementation': 'Increase capacity.', 'program': 'Hyundai Creta', 'customer_part_number': 'HC-AGM03',
     'cost_estimate': Decimal('350000'), 'department': 'ASSEMBLY', 'status': 'PENDING_AGM', 'current_stage': 'AGM',
     'requires_manpower_addition': True},
    {'title': 'AGM04: Server Room Expansion', 'station_name': 'IT Room', 'assembly_line': 'N/A',
     'issue_description': 'Running out of server capacity.', 'poka_yoke_description': 'Redundant power and cooling.',
     'reason_for_implementation': 'Support IT growth.', 'program': 'Admin', 'customer_part_number': 'ADM-AGM04',
     'cost_estimate': Decimal('125000'), 'department': 'ADMIN', 'status': 'PENDING_AGM', 'current_stage': 'AGM',
     'requires_process_addition': True},
    {'title': 'AGM05: ERP System Upgrade', 'station_name': 'IT Systems', 'assembly_line': 'N/A',
     'issue_description': 'Current ERP is outdated.', 'poka_yoke_description': 'Data validation and backups.',
     'reason_for_implementation': 'Modern features needed.', 'program': 'Finance', 'customer_part_number': 'FIN-AGM05',
     'cost_estimate': Decimal('280000'), 'department': 'ACCOUNTS', 'status': 'PENDING_AGM', 'current_stage': 'AGM',
     'requires_manpower_addition': True},

    # === PENDING_GM STATUS (5 requests) ===
    {'title': 'GM01: New Assembly Line', 'station_name': 'New Line D', 'assembly_line': 'Line D',
     'issue_description': 'Need additional capacity.', 'poka_yoke_description': 'Full line poka-yoke integration.',
     'reason_for_implementation': 'Meet demand growth.', 'program': 'Multi-Program', 'customer_part_number': 'MP-GM01',
     'cost_estimate': Decimal('850000'), 'department': 'PRODUCTION', 'status': 'PENDING_GM', 'current_stage': 'GM',
     'requires_process_addition': True, 'requires_manpower_addition': True},
    {'title': 'GM02: Warehouse Automation', 'station_name': 'Warehouse', 'assembly_line': 'N/A',
     'issue_description': 'Manual picking is slow.', 'poka_yoke_description': 'AGV with pick-to-light.',
     'reason_for_implementation': 'Improve logistics.', 'program': 'All Programs', 'customer_part_number': 'ALL-GM02',
     'cost_estimate': Decimal('520000'), 'department': 'MAINTENANCE', 'status': 'PENDING_GM', 'current_stage': 'GM',
     'requires_process_addition': True},
    {'title': 'GM03: Quality Lab Expansion', 'station_name': 'QA Lab', 'assembly_line': 'N/A',
     'issue_description': 'Lab equipment outdated.', 'poka_yoke_description': 'Calibrated measurement systems.',
     'reason_for_implementation': 'Customer requirements.', 'program': 'BMW X1', 'customer_part_number': 'BX1-GM03',
     'cost_estimate': Decimal('380000'), 'department': 'ASSEMBLY', 'status': 'PENDING_GM', 'current_stage': 'GM',
     'requires_manpower_addition': True},
    {'title': 'GM04: Building Expansion', 'station_name': 'Facility', 'assembly_line': 'N/A',
     'issue_description': 'Running out of floor space.', 'poka_yoke_description': 'Modern safety systems.',
     'reason_for_implementation': 'Support growth.', 'program': 'Admin', 'customer_part_number': 'ADM-GM04',
     'cost_estimate': Decimal('1200000'), 'department': 'ADMIN', 'status': 'PENDING_GM', 'current_stage': 'GM',
     'requires_process_addition': True, 'requires_manpower_addition': True},
    {'title': 'GM05: Complete Finance Overhaul', 'station_name': 'Finance Dept', 'assembly_line': 'N/A',
     'issue_description': 'Need integrated finance system.', 'poka_yoke_description': 'Audit trail and controls.',
     'reason_for_implementation': 'Regulatory compliance.', 'program': 'Finance', 'customer_part_number': 'FIN-GM05',
     'cost_estimate': Decimal('450000'), 'department': 'ACCOUNTS', 'status': 'PENDING_GM', 'current_stage': 'GM',
     'requires_manpower_addition': True},

    # === APPROVED STATUS (5 requests) ===
    {'title': 'APPROVED: Tool Calibration System', 'station_name': 'Tool Crib', 'assembly_line': 'N/A',
     'issue_description': 'Manual calibration tracking.', 'poka_yoke_description': 'Digital calibration records.',
     'reason_for_implementation': 'Ensure accuracy.', 'program': 'All Programs', 'customer_part_number': 'ALL-APP01',
     'cost_estimate': Decimal('32000'), 'department': 'MAINTENANCE', 'status': 'APPROVED', 'current_stage': 'COMPLETED'},
    {'title': 'APPROVED: Andon System', 'station_name': 'All Stations', 'assembly_line': 'Line B',
     'issue_description': 'No visual management.', 'poka_yoke_description': 'Visual and audio alerts.',
     'reason_for_implementation': 'Quick response.', 'program': 'Multi-Program', 'customer_part_number': 'MP-APP02',
     'cost_estimate': Decimal('75000'), 'department': 'PRODUCTION', 'status': 'APPROVED', 'current_stage': 'COMPLETED'},
    {'title': 'APPROVED: Anti-Fatigue Mats', 'station_name': 'Standing Stations', 'assembly_line': 'All Lines',
     'issue_description': 'Workers report foot pain.', 'poka_yoke_description': 'Color-coded zone mats.',
     'reason_for_implementation': 'Worker comfort.', 'program': 'All Programs', 'customer_part_number': 'ALL-APP03',
     'cost_estimate': Decimal('8000'), 'department': 'ASSEMBLY', 'status': 'APPROVED', 'current_stage': 'COMPLETED'},
    {'title': 'APPROVED: Safety Signage Update', 'station_name': 'All Areas', 'assembly_line': 'N/A',
     'issue_description': 'Old signs are faded.', 'poka_yoke_description': 'Photoluminescent signs.',
     'reason_for_implementation': 'Safety compliance.', 'program': 'Admin', 'customer_part_number': 'ADM-APP04',
     'cost_estimate': Decimal('12000'), 'department': 'ADMIN', 'status': 'APPROVED', 'current_stage': 'COMPLETED'},
    {'title': 'APPROVED: Tax Software Update', 'station_name': 'Finance Office', 'assembly_line': 'N/A',
     'issue_description': 'Need latest tax rules.', 'poka_yoke_description': 'Automatic updates.',
     'reason_for_implementation': 'Compliance.', 'program': 'Finance', 'customer_part_number': 'FIN-APP05',
     'cost_estimate': Decimal('18000'), 'department': 'ACCOUNTS', 'status': 'APPROVED', 'current_stage': 'COMPLETED'},

    # === REJECTED STATUS (5 requests) ===
    {'title': 'REJECTED: Gold-Plated Fixtures', 'station_name': 'Lobby', 'assembly_line': 'N/A',
     'issue_description': 'Want premium look.', 'poka_yoke_description': 'N/A',
     'reason_for_implementation': 'Aesthetics.', 'program': 'Admin', 'customer_part_number': 'ADM-REJ01',
     'cost_estimate': Decimal('250000'), 'department': 'ADMIN', 'status': 'REJECTED', 'current_stage': 'OWN_MANAGER',
     'rejection_reason': 'Not aligned with company priorities.'},
    {'title': 'REJECTED: Luxury Break Room', 'station_name': 'Break Room', 'assembly_line': 'N/A',
     'issue_description': 'Current break room is basic.', 'poka_yoke_description': 'N/A',
     'reason_for_implementation': 'Employee satisfaction.', 'program': 'Admin', 'customer_part_number': 'ADM-REJ02',
     'cost_estimate': Decimal('180000'), 'department': 'ADMIN', 'status': 'REJECTED', 'current_stage': 'OWN_HOD',
     'rejection_reason': 'Budget not available this fiscal year.'},
    {'title': 'REJECTED: Automated Parts Counter', 'station_name': 'Warehouse', 'assembly_line': 'N/A',
     'issue_description': 'Manual counting slow.', 'poka_yoke_description': 'Weight-based counting.',
     'reason_for_implementation': 'Speed up receiving.', 'program': 'All Programs', 'customer_part_number': 'ALL-REJ03',
     'cost_estimate': Decimal('45000'), 'department': 'ACCOUNTS', 'status': 'REJECTED', 'current_stage': 'CROSS_MANAGER',
     'rejection_reason': 'Space constraints in current layout.'},
    {'title': 'REJECTED: Premium Tool Brand', 'station_name': 'Tool Crib', 'assembly_line': 'N/A',
     'issue_description': 'Want premium brand tools.', 'poka_yoke_description': 'N/A',
     'reason_for_implementation': 'Quality perception.', 'program': 'All Programs', 'customer_part_number': 'ALL-REJ04',
     'cost_estimate': Decimal('120000'), 'department': 'MAINTENANCE', 'status': 'REJECTED', 'current_stage': 'AGM',
     'rejection_reason': 'Current tools meet requirements. Not cost justified.'},
    {'title': 'REJECTED: Full Automation Plan', 'station_name': 'All Stations', 'assembly_line': 'All Lines',
     'issue_description': 'Want full automation.', 'poka_yoke_description': 'Complete automation.',
     'reason_for_implementation': 'Reduce labor.', 'program': 'Multi-Program', 'customer_part_number': 'MP-REJ05',
     'cost_estimate': Decimal('5000000'), 'department': 'PRODUCTION', 'status': 'REJECTED', 'current_stage': 'GM',
     'rejection_reason': 'Investment too large. Phased approach recommended.'},
]

SAMPLE_SETTINGS = [
    ('costThresholds.hodLimit', 50000),
    ('costThresholds.agmLimit', 100000),
    ('sla.ownHodReviewHours', 24),
    ('sla.crossHodReviewHours', 48),
    ('sla.agmReviewHours', 48),
    ('sla.gmReviewHours', 72),
    ('sla.cftReviewHours', 24),
    ('sla.hodReviewHours', 24),
    ('notifications.emailEnabled', True),
    ('notifications.notifyOnSubmission', True),
    ('notifications.notifyOnEscalation', True),
    ('notifications.notifyOnApproval', True),
    ('notifications.notifyOnRejection', True),
    ('mandatoryAgmForResources', True),
]


class Command(BaseCommand):
    help = 'Seed comprehensive sample data for the application (50 requests)'
    
    def handle(self, *args, **options):
        self.stdout.write('=' * 60)
        self.stdout.write('Starting comprehensive data seeding (50 requests)...')
        self.stdout.write('=' * 60)
        
        # Seed departments
        self.seed_departments()
        
        # Seed users
        self.seed_users()
        
        # Seed settings
        self.seed_settings()
        
        # Seed kaizen requests
        self.seed_kaizen_requests()
        
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS('All sample data seeded successfully!'))
        self.stdout.write('=' * 60)
    
    def seed_departments(self):
        self.stdout.write('\n--- Seeding Departments ---')
        
        for name, display_name in DEPARTMENTS_DATA:
            dept, created = Department.objects.get_or_create(
                name=name,
                defaults={'display_name': display_name}
            )
            if created:
                self.stdout.write(f'  Created department: {display_name}')
            else:
                self.stdout.write(f'  Department exists: {display_name}')
            
            questions = EVALUATION_QUESTIONS.get(name, [])
            for order, (key, text) in enumerate(questions, 1):
                EvaluationQuestion.objects.get_or_create(
                    department=dept,
                    key=key,
                    defaults={'text': text, 'order': order}
                )
        
        self.stdout.write(self.style.SUCCESS(f'  {Department.objects.count()} departments configured'))
    
    def seed_users(self):
        self.stdout.write('\n--- Seeding Users ---')
        
        # Create admin user if not exists
        if not User.objects.filter(email='admin@example.com').exists():
            admin = User.objects.create_superuser(
                username='admin',
                email='admin@example.com',
                password='admin123',
                first_name='System',
                last_name='Admin',
                role='ADMIN'
            )
            self.stdout.write('  Created admin user: admin@example.com')
        else:
            self.stdout.write('  Admin user exists: admin@example.com')
        
        departments = {dept.name: dept for dept in Department.objects.all()}
        
        for user_data in SAMPLE_USERS:
            if User.objects.filter(email=user_data['email']).exists():
                self.stdout.write(f'  User exists: {user_data["email"]}')
                continue
            
            dept = departments.get(user_data['department'])
            user = User.objects.create_user(
                username=user_data['username'],
                email=user_data['email'],
                password=user_data['password'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                role=user_data['role'],
                department=dept,
                is_manager=user_data.get('is_manager', False),
                is_hod=user_data.get('is_hod', False)
            )
            self.stdout.write(f'  Created user: {user_data["email"]} ({user_data["role"]})')
        
        self.stdout.write(self.style.SUCCESS(f'  {User.objects.count()} total users'))
    
    def seed_settings(self):
        self.stdout.write('\n--- Seeding Settings ---')
        
        for key, value in SAMPLE_SETTINGS:
            Setting.objects.update_or_create(
                key=key,
                defaults={'value': value}
            )
        
        self.stdout.write(self.style.SUCCESS(f'  {Setting.objects.count()} settings configured'))
    
    def seed_kaizen_requests(self):
        self.stdout.write('\n--- Seeding Kaizen Requests (50 total) ---')
        
        # Clear existing requests for fresh seeding
        KaizenRequest.objects.all().delete()
        ManagerApproval.objects.all().delete()
        HodApproval.objects.all().delete()
        AgmApproval.objects.all().delete()
        GmApproval.objects.all().delete()
        DepartmentEvaluation.objects.all().delete()
        
        departments = {dept.name: dept for dept in Department.objects.all()}
        initiators = {user.department.name: user for user in User.objects.filter(role='INITIATOR')}
        managers = {user.department.name: user for user in User.objects.filter(role='MANAGER')}
        hods = {user.department.name: user for user in User.objects.filter(role='HOD')}
        agm = User.objects.filter(role='AGM').first()
        gm = User.objects.filter(role='GM').first()
        
        for i, req_data in enumerate(SAMPLE_REQUESTS, 1):
            dept_name = req_data['department']
            dept = departments.get(dept_name)
            initiator = initiators.get(dept_name)
            
            if not dept or not initiator:
                self.stdout.write(f'  Skipped: {req_data["title"]} (missing dept or initiator)')
                continue
            
            request_id = f'KZN-2024-{i:04d}'
            
            kaizen = KaizenRequest.objects.create(
                request_id=request_id,
                title=req_data['title'],
                station_name=req_data['station_name'],
                assembly_line=req_data['assembly_line'],
                issue_description=req_data['issue_description'],
                poka_yoke_description=req_data['poka_yoke_description'],
                reason_for_implementation=req_data['reason_for_implementation'],
                program=req_data['program'],
                customer_part_number=req_data['customer_part_number'],
                cost_estimate=req_data['cost_estimate'],
                feasibility_status=req_data.get('feasibility_status', 'FEASIBLE'),
                feasibility_reason=req_data.get('feasibility_reason', ''),
                expected_benefits=req_data.get('expected_benefits', []),
                requires_process_addition=req_data.get('requires_process_addition', False),
                requires_manpower_addition=req_data.get('requires_manpower_addition', False),
                department=dept,
                initiator=initiator,
                status=req_data['status'],
                current_stage=req_data['current_stage'],
                rejection_reason=req_data.get('rejection_reason', ''),
                date_of_origination=timezone.now().date() - timedelta(days=i),
            )
            
            # Create approval records based on status
            self._create_approvals_for_status(kaizen, req_data['status'], departments, managers, hods, agm, gm)
            
            self.stdout.write(f'  [{i:02d}/50] Created: {request_id} - {req_data["title"][:40]}... ({req_data["status"]})')
        
        self.stdout.write(self.style.SUCCESS(f'\n  {KaizenRequest.objects.count()} total requests created'))
        
        # Summary by status
        self.stdout.write('\n  --- Status Summary ---')
        for status in ['DRAFT', 'PENDING_OWN_MANAGER', 'PENDING_OWN_HOD', 'PENDING_CROSS_MANAGER', 
                       'PENDING_CROSS_HOD', 'PENDING_AGM', 'PENDING_GM', 'APPROVED', 'REJECTED']:
            count = KaizenRequest.objects.filter(status=status).count()
            if count > 0:
                self.stdout.write(f'    {status}: {count}')
    
    def _create_approvals_for_status(self, kaizen, status, departments, managers, hods, agm, gm):
        """Create appropriate approval records based on the request's current status."""
        
        # Statuses that have passed OWN_MANAGER stage
        if status in ['PENDING_OWN_HOD', 'PENDING_CROSS_MANAGER', 'PENDING_CROSS_HOD', 
                      'PENDING_AGM', 'PENDING_GM', 'APPROVED']:
            manager = managers.get(kaizen.department.name)
            if manager:
                ManagerApproval.objects.create(
                    kaizen_request=kaizen,
                    department=kaizen.department,
                    manager=manager,
                    decision='APPROVED',
                    remarks='Own manager approved.',
                    stage_type='OWN_MANAGER'
                )
        
        # Statuses that have passed OWN_HOD stage
        if status in ['PENDING_CROSS_MANAGER', 'PENDING_CROSS_HOD', 'PENDING_AGM', 'PENDING_GM', 'APPROVED']:
            hod = hods.get(kaizen.department.name)
            if hod:
                HodApproval.objects.create(
                    kaizen_request=kaizen,
                    department=kaizen.department,
                    hod=hod,
                    decision='APPROVED',
                    remarks='Own HOD approved.',
                    stage_type='OWN_HOD'
                )
        
        # Statuses that have passed CROSS_MANAGER stage
        if status in ['PENDING_CROSS_HOD', 'PENDING_AGM', 'PENDING_GM', 'APPROVED']:
            for dept_name, dept in departments.items():
                if dept.id != kaizen.department_id:
                    manager = managers.get(dept_name)
                    if manager:
                        ManagerApproval.objects.create(
                            kaizen_request=kaizen,
                            department=dept,
                            manager=manager,
                            decision='APPROVED',
                            remarks=f'Cross-manager from {dept_name} approved.',
                            stage_type='CROSS_MANAGER'
                        )
        
        # Statuses that have passed CROSS_HOD stage
        if status in ['PENDING_AGM', 'PENDING_GM', 'APPROVED']:
            for dept_name, dept in departments.items():
                if dept.id != kaizen.department_id:
                    hod = hods.get(dept_name)
                    if hod:
                        HodApproval.objects.create(
                            kaizen_request=kaizen,
                            department=dept,
                            hod=hod,
                            decision='APPROVED',
                            remarks=f'Cross-HOD from {dept_name} approved.',
                            stage_type='CROSS_HOD'
                        )
        
        # Statuses that have passed AGM stage
        if status in ['PENDING_GM', 'APPROVED'] and agm:
            AgmApproval.objects.create(
                kaizen_request=kaizen,
                agm=agm,
                approved=True,
                comments='AGM approved.',
                cost_justification='Cost justified based on ROI analysis.'
            )
        
        # Approved status - add GM approval if needed
        if status == 'APPROVED' and gm:
            if kaizen.cost_estimate > 100000:
                GmApproval.objects.create(
                    kaizen_request=kaizen,
                    gm=gm,
                    approved=True,
                    comments='GM approved.',
                    cost_justification='Strategic investment approved.'
                )
