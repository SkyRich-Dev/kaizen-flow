from django.db import models
from django.conf import settings


class KaizenRequest(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PENDING_OWN_MANAGER', 'Pending Own Manager Approval'),
        ('PENDING_OWN_HOD', 'Pending Own HOD Approval'),
        ('PENDING_CROSS_MANAGER', 'Pending Cross-Department Manager Approval'),
        ('PENDING_CROSS_HOD', 'Pending Cross-Department HOD Approval'),
        ('PENDING_AGM', 'Pending AGM Approval'),
        ('PENDING_GM', 'Pending GM Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    
    STAGE_CHOICES = [
        ('OWN_MANAGER', 'Own Manager'),
        ('OWN_HOD', 'Own HOD'),
        ('CROSS_MANAGER', 'Cross Manager'),
        ('CROSS_HOD', 'Cross HOD'),
        ('AGM', 'AGM'),
        ('GM', 'GM'),
        ('COMPLETED', 'Completed'),
    ]
    
    FEASIBILITY_CHOICES = [
        ('FEASIBLE', 'Feasible'),
        ('NOT_FEASIBLE', 'Not Feasible'),
        ('PENDING', 'Pending Review'),
    ]
    
    request_id = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=255)
    station_name = models.CharField(max_length=100)
    assembly_line = models.CharField(max_length=100, blank=True, null=True)
    issue_description = models.TextField()
    poka_yoke_description = models.TextField(blank=True, null=True)
    reason_for_implementation = models.TextField(blank=True, null=True)
    program = models.CharField(max_length=100)
    customer_part_number = models.CharField(max_length=100, blank=True, null=True)
    date_of_origination = models.DateField()
    
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT,
        related_name='kaizen_requests'
    )
    initiator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='initiated_requests'
    )
    
    feasibility_status = models.CharField(max_length=20, choices=FEASIBILITY_CHOICES, blank=True, null=True)
    feasibility_reason = models.TextField(blank=True, null=True)
    expected_benefits = models.JSONField(default=list, blank=True)
    effect_of_changes = models.JSONField(default=list, blank=True)
    
    cost_estimate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cost_currency = models.CharField(max_length=10, default='INR')
    cost_justification = models.TextField(blank=True, null=True)
    spare_cost_included = models.BooleanField(default=False)
    
    requires_process_addition = models.BooleanField(default=False)
    requires_manpower_addition = models.BooleanField(default=False)
    
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT')
    current_stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default='OWN_MANAGER')
    
    rejection_reason = models.TextField(blank=True, null=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rejected_requests'
    )
    rejected_by_department = models.CharField(max_length=50, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'dj_kaizen_requests'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.request_id} - {self.title}"
    
    def save(self, *args, **kwargs):
        if not self.request_id:
            from django.utils import timezone
            year = timezone.now().year
            last_request = KaizenRequest.objects.filter(
                request_id__startswith=f'KZ-{year}-'
            ).order_by('-id').first()
            
            if last_request:
                last_num = int(last_request.request_id.split('-')[-1])
                new_num = last_num + 1
            else:
                new_num = 1
            
            self.request_id = f'KZ-{year}-{new_num:03d}'
        
        super().save(*args, **kwargs)


class KaizenAttachment(models.Model):
    kaizen_request = models.ForeignKey(
        KaizenRequest,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to='attachments/%Y/%m/')
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100)
    file_size = models.PositiveIntegerField()
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'dj_kaizen_attachments'
    
    def __str__(self):
        return self.file_name
