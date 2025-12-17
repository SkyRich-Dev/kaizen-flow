from rest_framework import serializers
from .models import Department, EvaluationQuestion


class EvaluationQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationQuestion
        fields = ['id', 'key', 'text', 'is_required', 'order']


class DepartmentSerializer(serializers.ModelSerializer):
    evaluation_questions = EvaluationQuestionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Department
        fields = ['id', 'name', 'display_name', 'evaluation_questions', 'created_at']
