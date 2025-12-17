# KaizenFlow - Risk Assessment & Approval System

## Overview

KaizenFlow is an enterprise web application for digitizing the Kaizen Risk Assessment Process with end-to-end workflow automation. The system manages improvement requests through a 7-stage approval workflow:

**Complete Workflow:**
1. **Draft** → Request created by initiator
2. **Pending Own Manager** → Own department manager review
3. **Pending Own HOD** → Own department HOD approval
4. **Pending Cross-Managers** → All other department managers evaluate (4 approvals needed)
5. **Pending Cross-HODs** → All other department HODs evaluate (4 approvals needed)
6. **Pending AGM** → AGM approval (for costs >₹50k or resource additions)
7. **Pending GM** → GM approval (for costs >₹100k)
8. **Approved/Rejected** → Final status

Key capabilities include role-based dashboards, risk evaluation with acceptance/rejection tracking, cost-based approval thresholds, automated notifications, full audit trails, and comprehensive reporting with exports.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: React Context API for auth state, TanStack React Query for server state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

The frontend follows a feature-based structure with pages in `client/src/pages/`, reusable components in `client/src/components/`, and shared utilities in `client/src/lib/`.

### Backend Architecture (Django - NEW)
- **Framework**: Django 5.2 with Django REST Framework
- **Language**: Python 3.11
- **Authentication**: JWT-based with djangorestframework-simplejwt
- **API Design**: RESTful endpoints under `/api/` prefix
- **Database ORM**: Django ORM with PostgreSQL

Django apps structure:
- `accounts/` - User management and authentication
- `departments/` - Department and evaluation questions
- `kaizen_requests/` - Kaizen request lifecycle
- `approvals/` - Multi-stage approval workflow
- `audit/` - Audit logs and settings
- `reports/` - Reporting and exports

### Legacy Backend (Node.js - being migrated)
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- Files located in `server/` directory

### Data Layer
- **Database**: PostgreSQL
- **Django tables**: Prefixed with `dj_` (e.g., `dj_users`, `dj_kaizen_requests`)
- **Legacy tables**: Original Drizzle tables still exist for reference
- **Migrations**: Django migrations via `python manage.py migrate`

### Core Data Models
- **Users**: Role-based (INITIATOR, MANAGER, HOD, AGM, GM, ADMIN) with department assignments
- **Departments**: 5 departments - MAINTENANCE, PRODUCTION, ASSEMBLY, ADMIN, ACCOUNTS
- **Kaizen Requests**: Full lifecycle tracking with status workflow
- **Department Evaluations**: Mandatory risk assessment checklists per department at Manager and HOD approval stages
- **Approvals**: Multi-level approval records (Manager, HOD, AGM, GM) with comments
- **Audit Logs**: Complete action history for compliance
- **Settings**: Configurable thresholds and system parameters

### Department Evaluation Questions
At Cross-Department Manager and Cross-Department HOD approval stages:
- Maintenance: 7 questions (maint.q1-maint.q7)
- Production: 5 questions (prod.q1-prod.q5)
- Assembly: 6 questions (assy.q1-assy.q6)
- Admin: 4 questions (admin.q1-admin.q4)
- Accounts: 5 questions (acct.q1-acct.q5)
- Each question captures: answer (Yes/No), risk level (Low/Medium/High), remarks (mandatory for No or High risk)

### Workflow Logic
The approval routing is determined by cost thresholds and resource flags:
- Requests ≤₹50k: HOD approval sufficient
- Requests ₹50k-₹100k: Requires AGM approval
- Requests >₹100k: Requires GM approval
- Process/manpower additions: Mandatory AGM escalation regardless of cost

### API Endpoints (Django)
- `POST /api/auth/login/` - User authentication
- `GET /api/auth/me/` - Current user info
- `GET /api/departments/` - List departments
- `GET/POST /api/kaizen/` - List/create kaizen requests
- `GET/PUT /api/kaizen/<id>/` - Get/update request details
- `POST /api/approvals/kaizen/by-request-id/<id>/own-manager/` - Own Manager decision
- `POST /api/approvals/kaizen/by-request-id/<id>/own-hod/` - Own HOD decision
- `POST /api/approvals/kaizen/by-request-id/<id>/manager/` - Cross-Manager evaluation
- `POST /api/approvals/kaizen/by-request-id/<id>/cross-hod/` - Cross HOD evaluation
- `POST /api/approvals/kaizen/by-request-id/<id>/agm/` - AGM decision
- `POST /api/approvals/kaizen/by-request-id/<id>/gm/` - GM decision
- `GET /api/audit/logs/` - Audit logs

### Build & Deployment
- **Development**: 
  - Django backend: `python manage.py runserver 0.0.0.0:8000`
  - Frontend: Vite dev server on port 5000
- **Production**: 
  - Django with gunicorn/ASGI
  - Vite builds client to `dist/public/`

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable

### Python Dependencies
- Django 5.2
- djangorestframework
- djangorestframework-simplejwt
- django-cors-headers
- psycopg2-binary
- python-dotenv
- pillow

### UI Components
- **Radix UI**: Accessible primitive components (dialogs, dropdowns, forms, etc.)
- **Lucide React**: Icon library
- **cmdk**: Command palette component
- **embla-carousel-react**: Carousel functionality
- **recharts**: Data visualization for reports

### Development Tools
- **Vite**: Frontend build tool
- **Replit plugins**: Dev banner, cartographer, runtime error overlay (development only)

## Recent Changes

### December 2025
- Migrated backend from Node.js/Express to Django REST Framework
- Created Django apps: accounts, departments, kaizen_requests, approvals, audit, reports
- Updated departments to 5: MAINTENANCE, PRODUCTION, ASSEMBLY, ADMIN, ACCOUNTS
- Implemented JWT authentication with djangorestframework-simplejwt
- Created seed data management command for departments and evaluation questions
- Django tables prefixed with `dj_` to coexist with legacy Node.js tables
- **Added Own Manager stage**: Workflow now includes own department manager review before own HOD
- ManagerApproval model now has `stage_type` field (OWN_MANAGER, CROSS_MANAGER)
- Request statuses: DRAFT → PENDING_OWN_MANAGER → PENDING_OWN_HOD → PENDING_CROSS_MANAGER → PENDING_CROSS_HOD → PENDING_AGM → PENDING_GM → APPROVED/REJECTED

## Default Admin User
- Email: admin@example.com
- Password: admin123
