from rest_framework import serializers
from .models import ManagerApproval, HodApproval, AgmApproval, GmApproval, DepartmentEvaluation


class ManagerApprovalSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.get_full_name', read_only=True)
    department_name = serializers.CharField(source='department.display_name', read_only=True)
    
    class Meta:
        model = ManagerApproval
        fields = [
            'id', 'kaizen_request', 'manager', 'manager_name',
            'department', 'department_name', 'stage_type', 'decision', 'remarks',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'kaizen_request', 'manager', 'department', 'stage_type', 'created_at', 'updated_at']


class HodApprovalSerializer(serializers.ModelSerializer):
    hod_name = serializers.CharField(source='hod.get_full_name', read_only=True)
    department_name = serializers.CharField(source='department.display_name', read_only=True)
    
    class Meta:
        model = HodApproval
        fields = [
            'id', 'kaizen_request', 'hod', 'hod_name',
            'department', 'department_name', 'stage_type',
            'decision', 'remarks', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'kaizen_request', 'hod', 'department', 'stage_type', 'created_at', 'updated_at']


class AgmApprovalSerializer(serializers.ModelSerializer):
    agm_name = serializers.CharField(source='agm.get_full_name', read_only=True)
    
    class Meta:
        model = AgmApproval
        fields = [
            'id', 'kaizen_request', 'agm', 'agm_name',
            'approved', 'comments', 'cost_justification', 'approved_at'
        ]
        read_only_fields = ['id', 'kaizen_request', 'agm', 'approved_at']


class GmApprovalSerializer(serializers.ModelSerializer):
    gm_name = serializers.CharField(source='gm.get_full_name', read_only=True)
    
    class Meta:
        model = GmApproval
        fields = [
            'id', 'kaizen_request', 'gm', 'gm_name',
            'approved', 'comments', 'cost_justification', 'approved_at'
        ]
        read_only_fields = ['id', 'kaizen_request', 'gm', 'approved_at']


class DepartmentEvaluationSerializer(serializers.ModelSerializer):
    evaluator_name = serializers.CharField(source='evaluator.get_full_name', read_only=True)
    department_name = serializers.CharField(source='department.display_name', read_only=True)
    
    class Meta:
        model = DepartmentEvaluation
        fields = [
            'id', 'kaizen_request', 'evaluator', 'evaluator_name',
            'evaluator_role', 'department', 'department_name',
            'answers', 'overall_risk', 'created_at'
        ]
        read_only_fields = ['id', 'kaizen_request', 'evaluator', 'department', 'created_at']


class OwnManagerDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['APPROVED', 'REJECTED'])
    remarks = serializers.CharField(required=False, allow_blank=True)
    answers = serializers.ListField(child=serializers.DictField(), required=False)


class OwnHodDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['APPROVED', 'REJECTED'])
    remarks = serializers.CharField(required=False, allow_blank=True)
    answers = serializers.ListField(child=serializers.DictField(), required=False)


class ManagerEvaluationSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['APPROVED', 'REJECTED'])
    remarks = serializers.CharField(required=False, allow_blank=True)
    answers = serializers.ListField(child=serializers.DictField(), required=False)


class CrossHodEvaluationSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['APPROVED', 'REJECTED'])
    remarks = serializers.CharField(required=False, allow_blank=True)
    answers = serializers.ListField(child=serializers.DictField(), required=False)


class AgmDecisionSerializer(serializers.Serializer):
    approved = serializers.BooleanField()
    comments = serializers.CharField(required=False, allow_blank=True)
    cost_justification = serializers.CharField(required=False, allow_blank=True)


class GmDecisionSerializer(serializers.Serializer):
    approved = serializers.BooleanField()
    comments = serializers.CharField(required=False, allow_blank=True)
    cost_justification = serializers.CharField(required=False, allow_blank=True)
