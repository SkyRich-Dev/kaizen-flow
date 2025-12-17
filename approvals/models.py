from django.db import models
from django.conf import settings


class ManagerApproval(models.Model):
    DECISION_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    
    STAGE_CHOICES = [
        ('OWN_MANAGER', 'Own Manager'),
        ('CROSS_MANAGER', 'Cross Manager'),
    ]
    
    kaizen_request = models.ForeignKey(
        'kaizen_requests.KaizenRequest',
        on_delete=models.CASCADE,
        related_name='manager_approvals'
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='manager_approvals'
    )
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT
    )
    stage_type = models.CharField(max_length=20, choices=STAGE_CHOICES, default='CROSS_MANAGER')
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES, default='PENDING')
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'dj_manager_approvals'
        unique_together = ['kaizen_request', 'department', 'stage_type']
    
    def __str__(self):
        return f"{self.kaizen_request.request_id} - {self.department.name} Manager ({self.stage_type})"


class HodApproval(models.Model):
    DECISION_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    
    STAGE_CHOICES = [
        ('OWN_HOD', 'Own HOD'),
        ('CROSS_HOD', 'Cross HOD'),
    ]
    
    kaizen_request = models.ForeignKey(
        'kaizen_requests.KaizenRequest',
        on_delete=models.CASCADE,
        related_name='hod_approvals'
    )
    hod = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='hod_approvals'
    )
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT
    )
    stage_type = models.CharField(max_length=20, choices=STAGE_CHOICES)
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES, default='PENDING')
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'dj_hod_approvals'
        unique_together = ['kaizen_request', 'department', 'stage_type']
    
    def __str__(self):
        return f"{self.kaizen_request.request_id} - {self.department.name} HOD ({self.stage_type})"


class AgmApproval(models.Model):
    kaizen_request = models.OneToOneField(
        'kaizen_requests.KaizenRequest',
        on_delete=models.CASCADE,
        related_name='agm_approval'
    )
    agm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='agm_approvals'
    )
    approved = models.BooleanField()
    comments = models.TextField(blank=True, null=True)
    cost_justification = models.TextField(blank=True, null=True)
    approved_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'dj_agm_approvals'
    
    def __str__(self):
        return f"{self.kaizen_request.request_id} - AGM"


class GmApproval(models.Model):
    kaizen_request = models.OneToOneField(
        'kaizen_requests.KaizenRequest',
        on_delete=models.CASCADE,
        related_name='gm_approval'
    )
    gm = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='gm_approvals'
    )
    approved = models.BooleanField()
    comments = models.TextField(blank=True, null=True)
    cost_justification = models.TextField(blank=True, null=True)
    approved_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'dj_gm_approvals'
    
    def __str__(self):
        return f"{self.kaizen_request.request_id} - GM"


class DepartmentEvaluation(models.Model):
    RISK_LEVEL_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    ]
    
    EVALUATOR_ROLE_CHOICES = [
        ('MANAGER', 'Manager'),
        ('HOD', 'HOD'),
    ]
    
    kaizen_request = models.ForeignKey(
        'kaizen_requests.KaizenRequest',
        on_delete=models.CASCADE,
        related_name='department_evaluations'
    )
    evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='evaluations'
    )
    evaluator_role = models.CharField(max_length=20, choices=EVALUATOR_ROLE_CHOICES)
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT
    )
    answers = models.JSONField(default=list)
    overall_risk = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES, default='LOW')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'dj_department_evaluations'
        unique_together = ['kaizen_request', 'department', 'evaluator_role']
    
    def __str__(self):
        return f"{self.kaizen_request.request_id} - {self.department.name} ({self.evaluator_role})"
