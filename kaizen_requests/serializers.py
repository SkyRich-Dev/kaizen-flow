from rest_framework import serializers
from .models import KaizenRequest, KaizenAttachment
from departments.models import Department


class DepartmentField(serializers.Field):
    """Custom field that accepts department name string and returns Department object."""
    
    def to_representation(self, value):
        return value.name if value else None
    
    def to_internal_value(self, data):
        if not data:
            return None
        try:
            return Department.objects.get(name=data)
        except Department.DoesNotExist:
            raise serializers.ValidationError(f"Department '{data}' does not exist")


class KaizenAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = KaizenAttachment
        fields = ['id', 'file', 'file_name', 'file_type', 'file_size', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


class KaizenRequestSerializer(serializers.ModelSerializer):
    initiator_name = serializers.CharField(source='initiator.get_full_name', read_only=True)
    department_name = serializers.CharField(source='department.display_name', read_only=True)
    department = DepartmentField(required=False, allow_null=True)
    attachments = KaizenAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = KaizenRequest
        fields = [
            'id', 'request_id', 'title', 'station_name', 'assembly_line',
            'issue_description', 'poka_yoke_description', 'reason_for_implementation',
            'program', 'customer_part_number', 'date_of_origination',
            'department', 'department_name', 'initiator', 'initiator_name',
            'feasibility_status', 'feasibility_reason',
            'expected_benefits', 'effect_of_changes',
            'cost_estimate', 'cost_currency', 'cost_justification',
            'spare_cost_included', 'requires_process_addition', 'requires_manpower_addition',
            'status', 'current_stage',
            'rejection_reason', 'rejected_by', 'rejected_by_department',
            'attachments', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'request_id', 'initiator', 'status', 'current_stage', 'created_at', 'updated_at']


class KaizenRequestCreateSerializer(serializers.ModelSerializer):
    department = DepartmentField(required=False, allow_null=True)
    
    class Meta:
        model = KaizenRequest
        fields = [
            'title', 'station_name', 'assembly_line',
            'issue_description', 'poka_yoke_description', 'reason_for_implementation',
            'program', 'customer_part_number', 'date_of_origination',
            'department', 'feasibility_status', 'feasibility_reason',
            'expected_benefits', 'effect_of_changes',
            'cost_estimate', 'cost_currency', 'cost_justification',
            'spare_cost_included', 'requires_process_addition', 'requires_manpower_addition',
        ]
    
    def create(self, validated_data):
        validated_data['initiator'] = self.context['request'].user
        validated_data['status'] = 'PENDING_OWN_HOD'
        validated_data['current_stage'] = 'OWN_HOD'
        return super().create(validated_data)


class KaizenRequestDetailSerializer(KaizenRequestSerializer):
    class Meta(KaizenRequestSerializer.Meta):
        fields = KaizenRequestSerializer.Meta.fields
    
    def to_representation(self, instance):
        from approvals.serializers import (
            ManagerApprovalSerializer, HodApprovalSerializer,
            DepartmentEvaluationSerializer, AgmApprovalSerializer,
            GmApprovalSerializer
        )
        data = super().to_representation(instance)
        data['manager_approvals'] = ManagerApprovalSerializer(
            instance.manager_approvals.all(), many=True
        ).data
        data['hod_approvals'] = HodApprovalSerializer(
            instance.hod_approvals.all(), many=True
        ).data
        data['department_evaluations'] = DepartmentEvaluationSerializer(
            instance.department_evaluations.all(), many=True
        ).data
        try:
            data['agm_approval'] = AgmApprovalSerializer(instance.agm_approval).data
        except:
            data['agm_approval'] = None
        try:
            data['gm_approval'] = GmApprovalSerializer(instance.gm_approval).data
        except:
            data['gm_approval'] = None
        return data
