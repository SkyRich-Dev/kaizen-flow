from django.db.models import Count, Sum, Avg, Q, F
from django.db.models.functions import TruncMonth, TruncWeek
from django.utils import timezone
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from datetime import timedelta
import csv
import io

from kaizen_requests.models import KaizenRequest
from approvals.models import ManagerApproval, HodApproval, AgmApproval, GmApproval, DepartmentEvaluation
from departments.models import Department
from accounts.models import User
from audit.models import AuditLog


def get_role_filter(user, queryset_type='kaizen'):
    """Get queryset filter based on user role.
    
    For MANAGER/HOD: They see:
    1. Requests from their own department (they own)
    2. Requests where their department has pending cross-department evaluations
    """
    role = user.role
    
    if role == 'INITIATOR':
        return Q(initiator=user)
    elif role == 'MANAGER':
        # Manager sees:
        # 1. Their own department's requests
        # 2. Requests in PENDING_CROSS_MANAGER status where they haven't approved yet
        from approvals.models import ManagerApproval
        already_approved_ids = ManagerApproval.objects.filter(
            department=user.department,
            stage_type='CROSS_MANAGER'
        ).values_list('kaizen_request_id', flat=True)
        
        return (
            Q(department=user.department) |  # Own department
            (Q(status='PENDING_CROSS_MANAGER') & ~Q(id__in=already_approved_ids) & ~Q(department=user.department))  # Cross-dept pending
        )
    elif role == 'HOD':
        # HOD sees:
        # 1. Their own department's requests
        # 2. Requests in PENDING_CROSS_HOD status where they haven't approved yet
        from approvals.models import HodApproval
        already_approved_ids = HodApproval.objects.filter(
            department=user.department,
            stage_type='CROSS_HOD'
        ).values_list('kaizen_request_id', flat=True)
        
        return (
            Q(department=user.department) |  # Own department
            (Q(status='PENDING_CROSS_HOD') & ~Q(id__in=already_approved_ids) & ~Q(department=user.department))  # Cross-dept pending
        )
    elif role in ['AGM', 'GM', 'ADMIN']:
        # Full access
        return Q()
    return Q(initiator=user)


def apply_role_filter(queryset, user):
    """Apply role-based filter to a KaizenRequest queryset."""
    role_filter = get_role_filter(user)
    return queryset.filter(role_filter)


def apply_common_filters(queryset, request):
    """Apply common filters to queryset."""
    params = request.query_params
    
    if params.get('date_from'):
        queryset = queryset.filter(created_at__date__gte=params.get('date_from'))
    if params.get('date_to'):
        queryset = queryset.filter(created_at__date__lte=params.get('date_to'))
    if params.get('department'):
        queryset = queryset.filter(department_id=params.get('department'))
    if params.get('status'):
        queryset = queryset.filter(status=params.get('status'))
    if params.get('cost_min'):
        queryset = queryset.filter(cost_estimate__gte=params.get('cost_min'))
    if params.get('cost_max'):
        queryset = queryset.filter(cost_estimate__lte=params.get('cost_max'))
    if params.get('risk_level'):
        queryset = queryset.filter(department_evaluations__overall_risk=params.get('risk_level'))
    
    return queryset.distinct()


def export_csv(data, filename, headers):
    """Export data to CSV."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in data:
        writer.writerow(row)
    
    response = HttpResponse(output.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'
    return response


class MyKaizenRequestsReport(APIView):
    """3.1 My Kaizen Requests Report - For Initiators"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        queryset = KaizenRequest.objects.filter(initiator=request.user)
        queryset = apply_common_filters(queryset, request)
        
        data = []
        for kr in queryset.select_related('department'):
            pending_with = self._get_pending_with(kr)
            data.append({
                'id': kr.id,
                'request_id': kr.request_id,
                'title': kr.title,
                'department': kr.department.name,
                'station_name': kr.station_name,
                'current_status': kr.status,
                'pending_with': pending_with,
                'submission_date': kr.created_at.isoformat(),
                'final_decision': 'Approved' if kr.status == 'APPROVED' else ('Rejected' if kr.status == 'REJECTED' else 'Pending'),
                'rejection_reason': kr.rejection_reason
            })
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Title', 'Department', 'Station', 'Status', 'Pending With', 'Submission Date', 'Decision', 'Rejection Reason']
            rows = [[d['request_id'], d['title'], d['department'], d['station_name'], d['current_status'], d['pending_with'], d['submission_date'], d['final_decision'], d['rejection_reason'] or ''] for d in data]
            return export_csv(rows, 'my_kaizen_requests', headers)
        
        return Response(data)
    
    def _get_pending_with(self, kr):
        status_map = {
            'DRAFT': 'Draft',
            'PENDING_OWN_MANAGER': 'Own Manager',
            'PENDING_OWN_HOD': 'Own HOD',
            'PENDING_CROSS_MANAGER': 'Cross-Dept Managers',
            'PENDING_CROSS_HOD': 'Cross-Dept HODs',
            'PENDING_AGM': 'AGM',
            'PENDING_GM': 'GM',
            'APPROVED': 'Completed',
            'REJECTED': 'Completed'
        }
        return status_map.get(kr.status, kr.status)


class DepartmentKaizenSummaryReport(APIView):
    """4.1 Department Kaizen Summary Report - For Manager, HOD"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['MANAGER', 'HOD', 'AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        # Apply role-based filtering first
        queryset = apply_role_filter(KaizenRequest.objects.all(), request.user)
        queryset = apply_common_filters(queryset, request)
        
        data = []
        for kr in queryset.select_related('department').prefetch_related('department_evaluations'):
            days_in_workflow = (timezone.now() - kr.created_at).days
            overall_risk = 'LOW'
            for eval in kr.department_evaluations.all():
                if eval.overall_risk == 'HIGH':
                    overall_risk = 'HIGH'
                    break
                elif eval.overall_risk == 'MEDIUM' and overall_risk != 'HIGH':
                    overall_risk = 'MEDIUM'
            
            data.append({
                'id': kr.id,
                'request_id': kr.request_id,
                'title': kr.title,
                'department': kr.department.name,
                'current_stage': kr.current_stage,
                'status': kr.status,
                'cost_estimate': float(kr.cost_estimate),
                'risk_level': overall_risk,
                'days_in_workflow': days_in_workflow,
                'created_at': kr.created_at.isoformat()
            })
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Title', 'Department', 'Stage', 'Status', 'Cost', 'Risk', 'Days in Workflow']
            rows = [[d['request_id'], d['title'], d['department'], d['current_stage'], d['status'], d['cost_estimate'], d['risk_level'], d['days_in_workflow']] for d in data]
            return export_csv(rows, 'department_kaizen_summary', headers)
        
        return Response(data)


class DepartmentEvaluationDetailReport(APIView):
    """4.2 Department Evaluation Detail Report - For Manager, HOD, AGM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['MANAGER', 'HOD', 'AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        evals = DepartmentEvaluation.objects.all()
        
        if request.user.role in ['MANAGER', 'HOD']:
            evals = evals.filter(department=request.user.department)
        
        if request.query_params.get('date_from'):
            evals = evals.filter(created_at__date__gte=request.query_params.get('date_from'))
        if request.query_params.get('date_to'):
            evals = evals.filter(created_at__date__lte=request.query_params.get('date_to'))
        
        data = []
        for eval in evals.select_related('kaizen_request', 'evaluator', 'department'):
            for answer in eval.answers:
                data.append({
                    'kaizen_id': eval.kaizen_request.request_id,
                    'evaluator_role': eval.evaluator_role,
                    'evaluator_name': eval.evaluator.get_full_name(),
                    'evaluator_department': eval.department.name,
                    'question_id': answer.get('questionId', ''),
                    'question_text': answer.get('questionText', ''),
                    'answer': answer.get('answer', ''),
                    'risk_level': answer.get('riskLevel', 'LOW'),
                    'remarks': answer.get('remarks', ''),
                    'evaluation_date': eval.created_at.isoformat()
                })
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Evaluator Role', 'Evaluator', 'Department', 'Question', 'Answer', 'Risk', 'Remarks', 'Date']
            rows = [[d['kaizen_id'], d['evaluator_role'], d['evaluator_name'], d['evaluator_department'], d['question_text'][:50], d['answer'], d['risk_level'], d['remarks'][:50] if d['remarks'] else '', d['evaluation_date']] for d in data]
            return export_csv(rows, 'evaluation_details', headers)
        
        return Response(data)


class EvaluationRiskHeatmapReport(APIView):
    """4.3 Evaluation Risk Heatmap - For HOD, AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['HOD', 'AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        evals = DepartmentEvaluation.objects.all()
        
        if request.query_params.get('date_from'):
            evals = evals.filter(created_at__date__gte=request.query_params.get('date_from'))
        if request.query_params.get('date_to'):
            evals = evals.filter(created_at__date__lte=request.query_params.get('date_to'))
        
        dept_risk_counts = {}
        question_risk_counts = {}
        monthly_trends = {}
        
        for eval in evals.select_related('department'):
            dept_name = eval.department.name
            month_key = eval.created_at.strftime('%Y-%m')
            
            if dept_name not in dept_risk_counts:
                dept_risk_counts[dept_name] = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
            if month_key not in monthly_trends:
                monthly_trends[month_key] = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
            
            for answer in eval.answers:
                risk = answer.get('riskLevel', 'LOW')
                q_id = answer.get('questionId', 'unknown')
                
                dept_risk_counts[dept_name][risk] += 1
                monthly_trends[month_key][risk] += 1
                
                if q_id not in question_risk_counts:
                    question_risk_counts[q_id] = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0, 'text': answer.get('questionText', '')}
                question_risk_counts[q_id][risk] += 1
        
        high_risk_questions = sorted(
            [{'id': k, 'text': v['text'], 'high_count': v['HIGH'], 'medium_count': v['MEDIUM']} 
             for k, v in question_risk_counts.items()],
            key=lambda x: x['high_count'],
            reverse=True
        )[:10]
        
        return Response({
            'department_risk': dept_risk_counts,
            'high_risk_questions': high_risk_questions,
            'monthly_trends': monthly_trends
        })


class CrossDepartmentApprovalStatusReport(APIView):
    """5.1 Cross-Department Approval Status Report - For Manager, HOD, AGM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['MANAGER', 'HOD', 'AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        queryset = KaizenRequest.objects.filter(
            status__in=['PENDING_CROSS_MANAGER', 'PENDING_CROSS_HOD', 'PENDING_AGM', 'PENDING_GM', 'APPROVED', 'REJECTED']
        )
        # Apply role-based filtering
        queryset = apply_role_filter(queryset, request.user)
        queryset = apply_common_filters(queryset, request)
        
        departments = list(Department.objects.values_list('name', flat=True))
        total_depts = len(departments)
        
        data = []
        for kr in queryset.select_related('department').prefetch_related('manager_approvals', 'hod_approvals'):
            mgr_approved = kr.manager_approvals.filter(stage_type='CROSS_MANAGER', decision='APPROVED').values_list('department__name', flat=True)
            hod_approved = kr.hod_approvals.filter(stage_type='CROSS_HOD', decision='APPROVED').values_list('department__name', flat=True)
            
            pending_mgr = [d for d in departments if d != kr.department.name and d not in mgr_approved]
            pending_hod = [d for d in departments if d != kr.department.name and d not in hod_approved]
            
            mgr_completion = (len(mgr_approved) / (total_depts - 1)) * 100 if total_depts > 1 else 100
            hod_completion = (len(hod_approved) / (total_depts - 1)) * 100 if total_depts > 1 else 100
            
            data.append({
                'id': kr.id,
                'request_id': kr.request_id,
                'title': kr.title,
                'initiator_department': kr.department.name,
                'pending_manager_depts': pending_mgr,
                'pending_hod_depts': pending_hod,
                'manager_completion': round(mgr_completion, 1),
                'hod_completion': round(hod_completion, 1),
                'status': kr.status
            })
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Title', 'Department', 'Pending Managers', 'Pending HODs', 'Mgr %', 'HOD %', 'Status']
            rows = [[d['request_id'], d['title'], d['initiator_department'], ','.join(d['pending_manager_depts']), ','.join(d['pending_hod_depts']), d['manager_completion'], d['hod_completion'], d['status']] for d in data]
            return export_csv(rows, 'cross_dept_approval_status', headers)
        
        return Response(data)


class CrossDepartmentRejectionAnalysisReport(APIView):
    """5.2 Cross-Department Rejection Analysis - For HOD, AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['HOD', 'AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        rejected_requests = KaizenRequest.objects.filter(status='REJECTED')
        # Apply role-based filtering
        rejected_requests = apply_role_filter(rejected_requests, request.user)
        
        if request.query_params.get('date_from'):
            rejected_requests = rejected_requests.filter(created_at__date__gte=request.query_params.get('date_from'))
        if request.query_params.get('date_to'):
            rejected_requests = rejected_requests.filter(created_at__date__lte=request.query_params.get('date_to'))
        
        rejection_data = []
        for kr in rejected_requests.select_related('rejected_by', 'department'):
            rejection_data.append({
                'request_id': kr.request_id,
                'rejected_by_role': kr.rejected_by.role if kr.rejected_by else 'Unknown',
                'rejected_by_name': kr.rejected_by.get_full_name() if kr.rejected_by else 'Unknown',
                'rejected_department': kr.rejected_by_department or 'Unknown',
                'rejection_reason': kr.rejection_reason or 'No reason provided',
                'initiator_department': kr.department.name,
                'rejected_at': kr.updated_at.isoformat()
            })
        
        by_role = {}
        by_dept = {}
        by_reason = {}
        
        for item in rejection_data:
            role = item['rejected_by_role']
            dept = item['rejected_department']
            reason = item['rejection_reason'][:50] if item['rejection_reason'] else 'Unknown'
            
            by_role[role] = by_role.get(role, 0) + 1
            by_dept[dept] = by_dept.get(dept, 0) + 1
            by_reason[reason] = by_reason.get(reason, 0) + 1
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Rejected By Role', 'Rejected By', 'Department', 'Reason']
            rows = [[d['request_id'], d['rejected_by_role'], d['rejected_by_name'], d['rejected_department'], d['rejection_reason'][:100]] for d in rejection_data]
            return export_csv(rows, 'rejection_analysis', headers)
        
        return Response({
            'rejections': rejection_data,
            'summary': {
                'by_role': by_role,
                'by_department': by_dept,
                'by_reason': dict(sorted(by_reason.items(), key=lambda x: x[1], reverse=True)[:10])
            }
        })


class KaizenPipelineReport(APIView):
    """6.1 Kaizen Pipeline / Funnel Report - For AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        queryset = KaizenRequest.objects.all()
        queryset = apply_common_filters(queryset, request)
        
        pipeline = queryset.values('status').annotate(count=Count('id'))
        
        status_order = ['DRAFT', 'PENDING_OWN_MANAGER', 'PENDING_OWN_HOD', 'PENDING_CROSS_MANAGER', 
                       'PENDING_CROSS_HOD', 'PENDING_AGM', 'PENDING_GM', 'APPROVED', 'REJECTED']
        
        pipeline_data = {s: 0 for s in status_order}
        for item in pipeline:
            pipeline_data[item['status']] = item['count']
        
        total = sum(pipeline_data.values())
        
        funnel = []
        for s in status_order:
            funnel.append({
                'stage': s.replace('PENDING_', '').replace('_', ' ').title(),
                'count': pipeline_data[s],
                'percentage': round((pipeline_data[s] / total) * 100, 1) if total > 0 else 0
            })
        
        return Response({
            'total': total,
            'approved': pipeline_data['APPROVED'],
            'rejected': pipeline_data['REJECTED'],
            'pending': total - pipeline_data['APPROVED'] - pipeline_data['REJECTED'],
            'funnel': funnel,
            'pipeline': pipeline_data
        })


class CostImpactReport(APIView):
    """6.2 Cost Impact & Approval Limit Report - For Accounts, AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        queryset = KaizenRequest.objects.all()
        queryset = apply_common_filters(queryset, request)
        
        data = []
        for kr in queryset.select_related('department'):
            cost = float(kr.cost_estimate)
            if cost > 100000:
                approval_level = 'GM'
            elif cost > 50000 or kr.requires_process_addition or kr.requires_manpower_addition:
                approval_level = 'AGM'
            else:
                approval_level = 'HOD'
            
            data.append({
                'id': kr.id,
                'request_id': kr.request_id,
                'title': kr.title,
                'department': kr.department.name,
                'cost_estimate': cost,
                'approval_level_required': approval_level,
                'status': kr.status,
                'requires_process': kr.requires_process_addition,
                'requires_manpower': kr.requires_manpower_addition
            })
        
        total_cost = sum(d['cost_estimate'] for d in data)
        approved_cost = sum(d['cost_estimate'] for d in data if d['status'] == 'APPROVED')
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Title', 'Department', 'Cost', 'Approval Level', 'Status', 'Process Change', 'Manpower']
            rows = [[d['request_id'], d['title'], d['department'], d['cost_estimate'], d['approval_level_required'], d['status'], d['requires_process'], d['requires_manpower']] for d in data]
            return export_csv(rows, 'cost_impact', headers)
        
        return Response({
            'requests': data,
            'summary': {
                'total_cost': total_cost,
                'approved_cost': approved_cost,
                'pending_cost': total_cost - approved_cost,
                'by_level': {
                    'hod': len([d for d in data if d['approval_level_required'] == 'HOD']),
                    'agm': len([d for d in data if d['approval_level_required'] == 'AGM']),
                    'gm': len([d for d in data if d['approval_level_required'] == 'GM'])
                }
            }
        })


class BudgetUtilizationReport(APIView):
    """6.3 Budget Utilization Report - For Accounts, AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        approved = KaizenRequest.objects.filter(status='APPROVED')
        
        if request.query_params.get('date_from'):
            approved = approved.filter(created_at__date__gte=request.query_params.get('date_from'))
        if request.query_params.get('date_to'):
            approved = approved.filter(created_at__date__lte=request.query_params.get('date_to'))
        
        by_department = approved.values('department__name').annotate(
            total_cost=Sum('cost_estimate'),
            count=Count('id')
        )
        
        monthly_spend = approved.annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            total=Sum('cost_estimate'),
            count=Count('id')
        ).order_by('month')
        
        return Response({
            'by_department': list(by_department),
            'monthly_spend': [
                {'month': item['month'].strftime('%Y-%m') if item['month'] else '', 
                 'total': float(item['total'] or 0), 
                 'count': item['count']} 
                for item in monthly_spend
            ],
            'total_approved_cost': float(approved.aggregate(total=Sum('cost_estimate'))['total'] or 0),
            'total_approved_count': approved.count()
        })


class ManpowerProcessImpactReport(APIView):
    """6.4 Manpower & Process Impact Report - For AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        queryset = KaizenRequest.objects.filter(
            Q(requires_process_addition=True) | Q(requires_manpower_addition=True)
        )
        queryset = apply_common_filters(queryset, request)
        
        data = []
        for kr in queryset.select_related('department'):
            data.append({
                'id': kr.id,
                'request_id': kr.request_id,
                'title': kr.title,
                'department': kr.department.name,
                'requires_manpower': kr.requires_manpower_addition,
                'requires_process': kr.requires_process_addition,
                'cost_estimate': float(kr.cost_estimate),
                'status': kr.status
            })
        
        summary = {
            'manpower_only': len([d for d in data if d['requires_manpower'] and not d['requires_process']]),
            'process_only': len([d for d in data if d['requires_process'] and not d['requires_manpower']]),
            'both': len([d for d in data if d['requires_process'] and d['requires_manpower']]),
            'total': len(data)
        }
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Title', 'Department', 'Manpower', 'Process', 'Cost', 'Status']
            rows = [[d['request_id'], d['title'], d['department'], d['requires_manpower'], d['requires_process'], d['cost_estimate'], d['status']] for d in data]
            return export_csv(rows, 'manpower_process_impact', headers)
        
        return Response({
            'requests': data,
            'summary': summary
        })


class HighRiskKaizenReport(APIView):
    """7.1 High-Risk Kaizen Report - For HOD, AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['HOD', 'AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        high_risk_evals = DepartmentEvaluation.objects.filter(overall_risk='HIGH')
        high_risk_kaizen_ids = high_risk_evals.values_list('kaizen_request_id', flat=True).distinct()
        
        rejected_for_risk = KaizenRequest.objects.filter(
            status='REJECTED',
            rejection_reason__icontains='risk'
        )
        
        all_ids = set(high_risk_kaizen_ids) | set(rejected_for_risk.values_list('id', flat=True))
        
        queryset = KaizenRequest.objects.filter(id__in=all_ids)
        # Apply role-based filtering
        queryset = apply_role_filter(queryset, request.user)
        queryset = apply_common_filters(queryset, request)
        
        data = []
        for kr in queryset.select_related('department').prefetch_related('department_evaluations'):
            high_risk_depts = [e.department.name for e in kr.department_evaluations.filter(overall_risk='HIGH')]
            
            data.append({
                'id': kr.id,
                'request_id': kr.request_id,
                'title': kr.title,
                'department': kr.department.name,
                'high_risk_departments': high_risk_depts,
                'status': kr.status,
                'rejection_reason': kr.rejection_reason if kr.status == 'REJECTED' else None
            })
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Title', 'Department', 'High Risk Depts', 'Status', 'Rejection Reason']
            rows = [[d['request_id'], d['title'], d['department'], ','.join(d['high_risk_departments']), d['status'], d['rejection_reason'] or ''] for d in data]
            return export_csv(rows, 'high_risk_kaizen', headers)
        
        return Response(data)


class ComplianceDocumentationReport(APIView):
    """7.2 Compliance & Documentation Report - For Admin, AGM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        queryset = KaizenRequest.objects.all()
        queryset = apply_common_filters(queryset, request)
        
        data = []
        for kr in queryset.select_related('department').prefetch_related('attachments'):
            attachments = list(kr.attachments.values_list('file_name', flat=True))
            has_pfmea = any('pfmea' in a.lower() for a in attachments)
            has_crr = any('crr' in a.lower() for a in attachments)
            has_checksheet = any('check' in a.lower() for a in attachments)
            
            data.append({
                'id': kr.id,
                'request_id': kr.request_id,
                'title': kr.title,
                'department': kr.department.name,
                'status': kr.status,
                'has_pfmea': has_pfmea,
                'has_crr': has_crr,
                'has_checksheet': has_checksheet,
                'attachment_count': len(attachments),
                'missing_docs': []
            })
            
            if not has_pfmea:
                data[-1]['missing_docs'].append('PFMEA')
            if not has_crr:
                data[-1]['missing_docs'].append('CRR')
            if not has_checksheet:
                data[-1]['missing_docs'].append('Checksheet')
        
        incomplete = [d for d in data if d['missing_docs']]
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Title', 'Department', 'Status', 'PFMEA', 'CRR', 'Checksheet', 'Missing']
            rows = [[d['request_id'], d['title'], d['department'], d['status'], d['has_pfmea'], d['has_crr'], d['has_checksheet'], ','.join(d['missing_docs'])] for d in data]
            return export_csv(rows, 'compliance_documentation', headers)
        
        return Response({
            'requests': data,
            'summary': {
                'total': len(data),
                'complete': len(data) - len(incomplete),
                'incomplete': len(incomplete),
                'missing_pfmea': len([d for d in data if not d['has_pfmea']]),
                'missing_crr': len([d for d in data if not d['has_crr']]),
                'missing_checksheet': len([d for d in data if not d['has_checksheet']])
            }
        })


class AuditTrailReport(APIView):
    """7.3 Audit Trail Report - For Admin, AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        logs = AuditLog.objects.all().order_by('-created_at')
        
        if request.query_params.get('date_from'):
            logs = logs.filter(created_at__date__gte=request.query_params.get('date_from'))
        if request.query_params.get('date_to'):
            logs = logs.filter(created_at__date__lte=request.query_params.get('date_to'))
        if request.query_params.get('kaizen_id'):
            logs = logs.filter(details__contains={'request_id': request.query_params.get('kaizen_id')})
        if request.query_params.get('action'):
            logs = logs.filter(action__icontains=request.query_params.get('action'))
        
        logs = logs[:500]
        
        data = []
        for log in logs.select_related('user'):
            data.append({
                'id': log.id,
                'kaizen_id': log.details.get('request_id', '') if log.details else '',
                'action': log.action,
                'user': log.user.get_full_name() if log.user else 'System',
                'role': log.user.role if log.user else 'System',
                'department': log.user.department.name if log.user and log.user.department else '',
                'timestamp': log.created_at.isoformat(),
                'remarks': str(log.details)[:100] if log.details else ''
            })
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Action', 'User', 'Role', 'Department', 'Timestamp', 'Remarks']
            rows = [[d['kaizen_id'], d['action'], d['user'], d['role'], d['department'], d['timestamp'], d['remarks']] for d in data]
            return export_csv(rows, 'audit_trail', headers)
        
        return Response(data)


class SLADelayReport(APIView):
    """8.1 SLA & Delay Report - For HOD, AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['HOD', 'AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        sla_targets = {
            'PENDING_OWN_MANAGER': 24,
            'PENDING_OWN_HOD': 24,
            'PENDING_CROSS_MANAGER': 48,
            'PENDING_CROSS_HOD': 48,
            'PENDING_AGM': 48,
            'PENDING_GM': 72
        }
        
        pending = KaizenRequest.objects.filter(
            status__in=list(sla_targets.keys())
        )
        # Apply role-based filtering
        pending = apply_role_filter(pending, request.user)
        pending = apply_common_filters(pending, request)
        
        data = []
        for kr in pending.select_related('department'):
            hours_elapsed = (timezone.now() - kr.updated_at).total_seconds() / 3600
            target = sla_targets.get(kr.status, 24)
            delay_hours = max(0, hours_elapsed - target)
            
            data.append({
                'id': kr.id,
                'request_id': kr.request_id,
                'title': kr.title,
                'department': kr.department.name,
                'current_stage': kr.status.replace('PENDING_', '').replace('_', ' ').title(),
                'sla_target_hours': target,
                'actual_hours': round(hours_elapsed, 1),
                'delay_hours': round(delay_hours, 1),
                'is_delayed': delay_hours > 0,
                'last_updated': kr.updated_at.isoformat()
            })
        
        delayed = [d for d in data if d['is_delayed']]
        
        if request.query_params.get('export') == 'csv':
            headers = ['Kaizen ID', 'Title', 'Department', 'Stage', 'SLA Target (hrs)', 'Actual (hrs)', 'Delay (hrs)', 'Delayed']
            rows = [[d['request_id'], d['title'], d['department'], d['current_stage'], d['sla_target_hours'], d['actual_hours'], d['delay_hours'], d['is_delayed']] for d in data]
            return export_csv(rows, 'sla_delay', headers)
        
        return Response({
            'requests': data,
            'summary': {
                'total_pending': len(data),
                'delayed': len(delayed),
                'on_track': len(data) - len(delayed),
                'avg_delay_hours': round(sum(d['delay_hours'] for d in delayed) / len(delayed), 1) if delayed else 0
            }
        })


class ApprovalTATReport(APIView):
    """8.2 Approval Turnaround Time (TAT) Report - For AGM, GM"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role not in ['AGM', 'GM', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        completed = KaizenRequest.objects.filter(status__in=['APPROVED', 'REJECTED'])
        
        if request.query_params.get('date_from'):
            completed = completed.filter(created_at__date__gte=request.query_params.get('date_from'))
        if request.query_params.get('date_to'):
            completed = completed.filter(created_at__date__lte=request.query_params.get('date_to'))
        
        tat_data = []
        for kr in completed:
            total_hours = (kr.updated_at - kr.created_at).total_seconds() / 3600
            tat_data.append({
                'request_id': kr.request_id,
                'status': kr.status,
                'total_hours': round(total_hours, 1),
                'total_days': round(total_hours / 24, 1)
            })
        
        if not tat_data:
            return Response({
                'requests': [],
                'summary': {'avg_hours': 0, 'min_hours': 0, 'max_hours': 0}
            })
        
        avg_hours = sum(d['total_hours'] for d in tat_data) / len(tat_data)
        min_hours = min(d['total_hours'] for d in tat_data)
        max_hours = max(d['total_hours'] for d in tat_data)
        
        fastest = sorted(tat_data, key=lambda x: x['total_hours'])[:5]
        slowest = sorted(tat_data, key=lambda x: x['total_hours'], reverse=True)[:5]
        
        return Response({
            'summary': {
                'avg_hours': round(avg_hours, 1),
                'avg_days': round(avg_hours / 24, 1),
                'min_hours': round(min_hours, 1),
                'max_hours': round(max_hours, 1),
                'total_completed': len(tat_data)
            },
            'fastest': fastest,
            'slowest': slowest
        })


class NotificationDeliveryReport(APIView):
    """9.1 Notification Delivery Report - For System Admin"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        logs = AuditLog.objects.filter(
            action__in=['EMAIL_SENT', 'EMAIL_FAILED', 'WHATSAPP_SENT', 'WHATSAPP_FAILED', 'EMAIL_TEST_SENT', 'WHATSAPP_TEST_SENT']
        ).order_by('-created_at')[:200]
        
        data = []
        for log in logs:
            is_email = 'EMAIL' in log.action
            data.append({
                'id': log.id,
                'notification_type': 'Email' if is_email else 'WhatsApp',
                'trigger_event': log.action,
                'status': 'Sent' if 'SENT' in log.action and 'FAILED' not in log.action else 'Failed',
                'failure_reason': log.details.get('error', '') if log.details and 'FAILED' in log.action else '',
                'timestamp': log.created_at.isoformat()
            })
        
        return Response(data)


class UserActivityReport(APIView):
    """9.2 User Activity Report - For System Admin"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        users = User.objects.all().select_related('department')
        
        data = []
        for user in users:
            approval_count = (
                ManagerApproval.objects.filter(manager=user, decision__in=['APPROVED', 'REJECTED']).count() +
                HodApproval.objects.filter(hod=user, decision__in=['APPROVED', 'REJECTED']).count()
            )
            
            actions = AuditLog.objects.filter(user=user).count()
            last_login = user.last_login.isoformat() if user.last_login else 'Never'
            
            data.append({
                'id': user.id,
                'username': user.username,
                'full_name': user.get_full_name(),
                'role': user.role,
                'department': user.department.name if user.department else '',
                'actions_count': actions,
                'approval_count': approval_count,
                'last_login': last_login,
                'is_active': user.is_active
            })
        
        if request.query_params.get('export') == 'csv':
            headers = ['Username', 'Name', 'Role', 'Department', 'Actions', 'Approvals', 'Last Login', 'Active']
            rows = [[d['username'], d['full_name'], d['role'], d['department'], d['actions_count'], d['approval_count'], d['last_login'], d['is_active']] for d in data]
            return export_csv(rows, 'user_activity', headers)
        
        return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_dashboard(request):
    """Dashboard summary for the current user's role."""
    user = request.user
    role = user.role
    
    base_filter = get_role_filter(user)
    
    queryset = KaizenRequest.objects.filter(base_filter) if base_filter else KaizenRequest.objects.all()
    
    total = queryset.count()
    approved = queryset.filter(status='APPROVED').count()
    rejected = queryset.filter(status='REJECTED').count()
    pending = total - approved - rejected
    
    by_status = list(queryset.values('status').annotate(count=Count('id')))
    
    recent = queryset.order_by('-created_at')[:5].values('request_id', 'title', 'status', 'created_at')
    
    available_reports = []
    
    if role == 'INITIATOR':
        available_reports = ['my-requests']
    elif role == 'MANAGER':
        available_reports = ['my-requests', 'department-summary', 'evaluation-details', 'cross-dept-status']
    elif role == 'HOD':
        available_reports = ['my-requests', 'department-summary', 'evaluation-details', 'risk-heatmap', 'cross-dept-status', 'rejection-analysis', 'high-risk', 'sla-delay']
    elif role in ['AGM', 'GM']:
        available_reports = ['my-requests', 'department-summary', 'evaluation-details', 'risk-heatmap', 'cross-dept-status', 'rejection-analysis', 'pipeline', 'cost-impact', 'budget', 'manpower-process', 'high-risk', 'compliance', 'audit-trail', 'sla-delay', 'tat']
    elif role == 'ADMIN':
        available_reports = ['my-requests', 'department-summary', 'evaluation-details', 'risk-heatmap', 'cross-dept-status', 'rejection-analysis', 'pipeline', 'cost-impact', 'budget', 'manpower-process', 'high-risk', 'compliance', 'audit-trail', 'sla-delay', 'tat', 'notifications', 'user-activity']
    
    return Response({
        'summary': {
            'total': total,
            'approved': approved,
            'rejected': rejected,
            'pending': pending
        },
        'by_status': by_status,
        'recent': list(recent),
        'available_reports': available_reports
    })
