from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from kaizen_requests.models import KaizenRequest
from kaizen_requests.serializers import KaizenRequestDetailSerializer
from departments.models import Department
from audit.models import AuditLog
from .models import HodApproval, ManagerApproval, AgmApproval, GmApproval, DepartmentEvaluation
from .serializers import (
    OwnManagerDecisionSerializer, OwnHodDecisionSerializer, ManagerEvaluationSerializer,
    CrossHodEvaluationSerializer, AgmDecisionSerializer, GmDecisionSerializer
)


def create_audit_log(request, kaizen, action, details=None):
    AuditLog.objects.create(
        kaizen_request=kaizen,
        user=request.user,
        action=action,
        details=details or {},
        ip_address=request.META.get('REMOTE_ADDR'),
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def own_manager_decision(request, pk):
    if request.user.role != 'MANAGER':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = OwnManagerDecisionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(
            pk=pk,
            status='PENDING_OWN_MANAGER',
            department=request.user.department
        )
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found or not pending your approval'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        decision = serializer.validated_data['decision']
        remarks = serializer.validated_data.get('remarks', '')
        answers = serializer.validated_data.get('answers', [])
        
        ManagerApproval.objects.create(
            kaizen_request=kaizen,
            manager=request.user,
            department=request.user.department,
            stage_type='OWN_MANAGER',
            decision=decision,
            remarks=remarks
        )
        
        if answers:
            DepartmentEvaluation.objects.update_or_create(
                kaizen_request=kaizen,
                department=request.user.department,
                evaluator_role='MANAGER',
                defaults={
                    'evaluator': request.user,
                    'answers': answers,
                    'overall_risk': _calculate_risk(answers)
                }
            )
        
        if decision == 'APPROVED':
            kaizen.status = 'PENDING_OWN_HOD'
            kaizen.current_stage = 'OWN_HOD'
            create_audit_log(request, kaizen, 'OWN_MANAGER_APPROVED', {'remarks': remarks})
        else:
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = remarks
            kaizen.rejected_by = request.user
            kaizen.rejected_by_department = request.user.department.name
            create_audit_log(request, kaizen, 'OWN_MANAGER_REJECTED', {'remarks': remarks})
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def own_hod_decision(request, pk):
    if request.user.role != 'HOD':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = OwnHodDecisionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(
            pk=pk,
            status='PENDING_OWN_HOD',
            department=request.user.department
        )
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found or not pending your approval'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        decision = serializer.validated_data['decision']
        remarks = serializer.validated_data.get('remarks', '')
        answers = serializer.validated_data.get('answers', [])
        
        HodApproval.objects.create(
            kaizen_request=kaizen,
            hod=request.user,
            department=request.user.department,
            stage_type='OWN_HOD',
            decision=decision,
            remarks=remarks
        )
        
        if answers:
            DepartmentEvaluation.objects.update_or_create(
                kaizen_request=kaizen,
                department=request.user.department,
                evaluator_role='HOD',
                defaults={
                    'evaluator': request.user,
                    'answers': answers,
                    'overall_risk': _calculate_risk(answers)
                }
            )
        
        if decision == 'APPROVED':
            kaizen.status = 'PENDING_CROSS_MANAGER'
            kaizen.current_stage = 'CROSS_MANAGER'
            create_audit_log(request, kaizen, 'OWN_HOD_APPROVED', {'remarks': remarks})
        else:
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = remarks
            kaizen.rejected_by = request.user
            kaizen.rejected_by_department = request.user.department.name
            create_audit_log(request, kaizen, 'OWN_HOD_REJECTED', {'remarks': remarks})
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def manager_evaluation(request, pk):
    if request.user.role != 'MANAGER':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = ManagerEvaluationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(pk=pk, status='PENDING_CROSS_MANAGER')
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        decision = serializer.validated_data['decision']
        remarks = serializer.validated_data.get('remarks', '')
        answers = serializer.validated_data.get('answers', [])
        
        ManagerApproval.objects.update_or_create(
            kaizen_request=kaizen,
            department=request.user.department,
            stage_type='CROSS_MANAGER',
            defaults={
                'manager': request.user,
                'decision': decision,
                'remarks': remarks
            }
        )
        
        if answers:
            DepartmentEvaluation.objects.update_or_create(
                kaizen_request=kaizen,
                department=request.user.department,
                evaluator_role='MANAGER',
                defaults={
                    'evaluator': request.user,
                    'answers': answers,
                    'overall_risk': _calculate_risk(answers)
                }
            )
        
        other_departments = Department.objects.exclude(id=kaizen.department_id)
        cross_approvals = ManagerApproval.objects.filter(kaizen_request=kaizen, stage_type='CROSS_MANAGER')
        
        if decision == 'REJECTED':
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = remarks
            kaizen.rejected_by = request.user
            kaizen.rejected_by_department = request.user.department.name
            create_audit_log(request, kaizen, 'CROSS_MANAGER_REJECTED', {'department': request.user.department.name})
        elif cross_approvals.filter(decision='APPROVED').count() == other_departments.count():
            kaizen.status = 'PENDING_CROSS_HOD'
            kaizen.current_stage = 'CROSS_HOD'
            create_audit_log(request, kaizen, 'CROSS_MANAGER_APPROVED', {'department': request.user.department.name})
        else:
            create_audit_log(request, kaizen, 'CROSS_MANAGER_APPROVED', {'department': request.user.department.name})
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cross_hod_evaluation(request, pk):
    if request.user.role != 'HOD':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = CrossHodEvaluationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(pk=pk, status='PENDING_CROSS_HOD')
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        decision = serializer.validated_data['decision']
        remarks = serializer.validated_data.get('remarks', '')
        answers = serializer.validated_data.get('answers', [])
        
        HodApproval.objects.update_or_create(
            kaizen_request=kaizen,
            department=request.user.department,
            stage_type='CROSS_HOD',
            defaults={
                'hod': request.user,
                'decision': decision,
                'remarks': remarks
            }
        )
        
        if answers:
            DepartmentEvaluation.objects.update_or_create(
                kaizen_request=kaizen,
                department=request.user.department,
                evaluator_role='HOD',
                defaults={
                    'evaluator': request.user,
                    'answers': answers,
                    'overall_risk': _calculate_risk(answers)
                }
            )
        
        if decision == 'REJECTED':
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = remarks
            kaizen.rejected_by = request.user
            kaizen.rejected_by_department = request.user.department.name
            create_audit_log(request, kaizen, 'CROSS_HOD_REJECTED', {'department': request.user.department.name})
        else:
            other_departments = Department.objects.exclude(id=kaizen.department_id)
            hod_approvals = HodApproval.objects.filter(kaizen_request=kaizen, stage_type='CROSS_HOD')
            
            if hod_approvals.filter(decision='APPROVED').count() >= other_departments.count():
                if _requires_agm(kaizen):
                    kaizen.status = 'PENDING_AGM'
                    kaizen.current_stage = 'AGM'
                else:
                    kaizen.status = 'APPROVED'
                    kaizen.current_stage = 'COMPLETED'
            create_audit_log(request, kaizen, 'CROSS_HOD_APPROVED', {'department': request.user.department.name})
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agm_decision(request, pk):
    if request.user.role != 'AGM':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = AgmDecisionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(pk=pk, status='PENDING_AGM')
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        approved = serializer.validated_data['approved']
        
        AgmApproval.objects.create(
            kaizen_request=kaizen,
            agm=request.user,
            approved=approved,
            comments=serializer.validated_data.get('comments', ''),
            cost_justification=serializer.validated_data.get('cost_justification', '')
        )
        
        if approved:
            if _requires_gm(kaizen):
                kaizen.status = 'PENDING_GM'
                kaizen.current_stage = 'GM'
            else:
                kaizen.status = 'APPROVED'
                kaizen.current_stage = 'COMPLETED'
            create_audit_log(request, kaizen, 'AGM_APPROVED')
        else:
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = serializer.validated_data.get('comments', '')
            kaizen.rejected_by = request.user
            create_audit_log(request, kaizen, 'AGM_REJECTED')
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gm_decision(request, pk):
    if request.user.role != 'GM':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = GmDecisionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(pk=pk, status='PENDING_GM')
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        approved = serializer.validated_data['approved']
        
        GmApproval.objects.create(
            kaizen_request=kaizen,
            gm=request.user,
            approved=approved,
            comments=serializer.validated_data.get('comments', ''),
            cost_justification=serializer.validated_data.get('cost_justification', '')
        )
        
        if approved:
            kaizen.status = 'APPROVED'
            kaizen.current_stage = 'COMPLETED'
            create_audit_log(request, kaizen, 'GM_APPROVED')
        else:
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = serializer.validated_data.get('comments', '')
            kaizen.rejected_by = request.user
            create_audit_log(request, kaizen, 'GM_REJECTED')
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


def _calculate_risk(answers):
    if not answers:
        return 'LOW'
    
    high_count = sum(1 for a in answers if a.get('risk_level') == 'HIGH')
    medium_count = sum(1 for a in answers if a.get('risk_level') == 'MEDIUM')
    
    if high_count > 0:
        return 'HIGH'
    elif medium_count >= 2:
        return 'MEDIUM'
    return 'LOW'


def _requires_agm(kaizen):
    cost = float(kaizen.cost_estimate or 0)
    return (
        cost > 50000 or
        kaizen.requires_process_addition or
        kaizen.requires_manpower_addition
    )


def _requires_gm(kaizen):
    cost = float(kaizen.cost_estimate or 0)
    return cost > 100000


def _get_kaizen_by_request_id(request_id):
    try:
        return KaizenRequest.objects.get(request_id=request_id)
    except KaizenRequest.DoesNotExist:
        return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def own_manager_decision_by_request_id(request, request_id):
    if request.user.role != 'MANAGER':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = OwnManagerDecisionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(
            request_id=request_id,
            status='PENDING_OWN_MANAGER',
            department=request.user.department
        )
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found or not pending your approval'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        decision = serializer.validated_data['decision']
        remarks = serializer.validated_data.get('remarks', '')
        answers = serializer.validated_data.get('answers', [])
        
        ManagerApproval.objects.create(
            kaizen_request=kaizen,
            manager=request.user,
            department=request.user.department,
            stage_type='OWN_MANAGER',
            decision=decision,
            remarks=remarks
        )
        
        if answers:
            DepartmentEvaluation.objects.update_or_create(
                kaizen_request=kaizen,
                department=request.user.department,
                evaluator_role='MANAGER',
                defaults={
                    'evaluator': request.user,
                    'answers': answers,
                    'overall_risk': _calculate_risk(answers)
                }
            )
        
        if decision == 'APPROVED':
            kaizen.status = 'PENDING_OWN_HOD'
            kaizen.current_stage = 'OWN_HOD'
            create_audit_log(request, kaizen, 'OWN_MANAGER_APPROVED', {'remarks': remarks})
        else:
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = remarks
            kaizen.rejected_by = request.user
            kaizen.rejected_by_department = request.user.department.name
            create_audit_log(request, kaizen, 'OWN_MANAGER_REJECTED', {'remarks': remarks})
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def own_hod_decision_by_request_id(request, request_id):
    if request.user.role != 'HOD':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = OwnHodDecisionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(
            request_id=request_id,
            status='PENDING_OWN_HOD',
            department=request.user.department
        )
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found or not pending your approval'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        decision = serializer.validated_data['decision']
        remarks = serializer.validated_data.get('remarks', '')
        answers = serializer.validated_data.get('answers', [])
        
        HodApproval.objects.create(
            kaizen_request=kaizen,
            hod=request.user,
            department=request.user.department,
            stage_type='OWN_HOD',
            decision=decision,
            remarks=remarks
        )
        
        if answers:
            DepartmentEvaluation.objects.update_or_create(
                kaizen_request=kaizen,
                department=request.user.department,
                evaluator_role='HOD',
                defaults={
                    'evaluator': request.user,
                    'answers': answers,
                    'overall_risk': _calculate_risk(answers)
                }
            )
        
        if decision == 'APPROVED':
            kaizen.status = 'PENDING_CROSS_MANAGER'
            kaizen.current_stage = 'CROSS_MANAGER'
            create_audit_log(request, kaizen, 'OWN_HOD_APPROVED', {'remarks': remarks})
        else:
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = remarks
            kaizen.rejected_by = request.user
            kaizen.rejected_by_department = request.user.department.name
            create_audit_log(request, kaizen, 'OWN_HOD_REJECTED', {'remarks': remarks})
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def manager_evaluation_by_request_id(request, request_id):
    if request.user.role != 'MANAGER':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = ManagerEvaluationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(request_id=request_id, status='PENDING_CROSS_MANAGER')
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        decision = serializer.validated_data['decision']
        remarks = serializer.validated_data.get('remarks', '')
        answers = serializer.validated_data.get('answers', [])
        
        ManagerApproval.objects.update_or_create(
            kaizen_request=kaizen,
            department=request.user.department,
            stage_type='CROSS_MANAGER',
            defaults={
                'manager': request.user,
                'decision': decision,
                'remarks': remarks
            }
        )
        
        if answers:
            DepartmentEvaluation.objects.update_or_create(
                kaizen_request=kaizen,
                department=request.user.department,
                evaluator_role='MANAGER',
                defaults={
                    'evaluator': request.user,
                    'answers': answers,
                    'overall_risk': _calculate_risk(answers)
                }
            )
        
        other_departments = Department.objects.exclude(id=kaizen.department_id)
        cross_approvals = ManagerApproval.objects.filter(kaizen_request=kaizen, stage_type='CROSS_MANAGER')
        
        if decision == 'REJECTED':
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = remarks
            kaizen.rejected_by = request.user
            kaizen.rejected_by_department = request.user.department.name
            create_audit_log(request, kaizen, 'CROSS_MANAGER_REJECTED', {'department': request.user.department.name})
        elif cross_approvals.filter(decision='APPROVED').count() == other_departments.count():
            kaizen.status = 'PENDING_CROSS_HOD'
            kaizen.current_stage = 'CROSS_HOD'
            create_audit_log(request, kaizen, 'CROSS_MANAGER_APPROVED', {'department': request.user.department.name})
        else:
            create_audit_log(request, kaizen, 'MANAGER_APPROVED', {'department': request.user.department.name})
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cross_hod_evaluation_by_request_id(request, request_id):
    if request.user.role != 'HOD':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = CrossHodEvaluationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(request_id=request_id, status='PENDING_CROSS_HOD')
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        decision = serializer.validated_data['decision']
        remarks = serializer.validated_data.get('remarks', '')
        answers = serializer.validated_data.get('answers', [])
        
        HodApproval.objects.update_or_create(
            kaizen_request=kaizen,
            department=request.user.department,
            stage_type='CROSS_HOD',
            defaults={
                'hod': request.user,
                'decision': decision,
                'remarks': remarks
            }
        )
        
        if answers:
            DepartmentEvaluation.objects.update_or_create(
                kaizen_request=kaizen,
                department=request.user.department,
                evaluator_role='HOD',
                defaults={
                    'evaluator': request.user,
                    'answers': answers,
                    'overall_risk': _calculate_risk(answers)
                }
            )
        
        if decision == 'REJECTED':
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = remarks
            kaizen.rejected_by = request.user
            kaizen.rejected_by_department = request.user.department.name
            create_audit_log(request, kaizen, 'CROSS_HOD_REJECTED', {'department': request.user.department.name})
        else:
            other_departments = Department.objects.exclude(id=kaizen.department_id)
            hod_approvals = HodApproval.objects.filter(kaizen_request=kaizen, stage_type='CROSS_HOD')
            
            if hod_approvals.filter(decision='APPROVED').count() >= other_departments.count():
                if _requires_agm(kaizen):
                    kaizen.status = 'PENDING_AGM'
                    kaizen.current_stage = 'AGM'
                else:
                    kaizen.status = 'APPROVED'
                    kaizen.current_stage = 'COMPLETED'
            create_audit_log(request, kaizen, 'CROSS_HOD_APPROVED', {'department': request.user.department.name})
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agm_decision_by_request_id(request, request_id):
    if request.user.role != 'AGM':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = AgmDecisionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(request_id=request_id, status='PENDING_AGM')
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        approved = serializer.validated_data['approved']
        
        AgmApproval.objects.create(
            kaizen_request=kaizen,
            agm=request.user,
            approved=approved,
            comments=serializer.validated_data.get('comments', ''),
            cost_justification=serializer.validated_data.get('cost_justification', '')
        )
        
        if approved:
            if _requires_gm(kaizen):
                kaizen.status = 'PENDING_GM'
                kaizen.current_stage = 'GM'
            else:
                kaizen.status = 'APPROVED'
                kaizen.current_stage = 'COMPLETED'
            create_audit_log(request, kaizen, 'AGM_APPROVED')
        else:
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = serializer.validated_data.get('comments', '')
            kaizen.rejected_by = request.user
            create_audit_log(request, kaizen, 'AGM_REJECTED')
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gm_decision_by_request_id(request, request_id):
    if request.user.role != 'GM':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = GmDecisionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        kaizen = KaizenRequest.objects.get(request_id=request_id, status='PENDING_GM')
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    with transaction.atomic():
        approved = serializer.validated_data['approved']
        
        GmApproval.objects.create(
            kaizen_request=kaizen,
            gm=request.user,
            approved=approved,
            comments=serializer.validated_data.get('comments', ''),
            cost_justification=serializer.validated_data.get('cost_justification', '')
        )
        
        if approved:
            kaizen.status = 'APPROVED'
            kaizen.current_stage = 'COMPLETED'
            create_audit_log(request, kaizen, 'GM_APPROVED')
        else:
            kaizen.status = 'REJECTED'
            kaizen.rejection_reason = serializer.validated_data.get('comments', '')
            kaizen.rejected_by = request.user
            create_audit_log(request, kaizen, 'GM_REJECTED')
        
        kaizen.save()
    
    return Response(KaizenRequestDetailSerializer(kaizen).data)
