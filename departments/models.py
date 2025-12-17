from django.db import models


class Department(models.Model):
    DEPARTMENT_CHOICES = [
        ('MAINTENANCE', 'Maintenance'),
        ('PRODUCTION', 'Production'),
        ('ASSEMBLY', 'Assembly'),
        ('ADMIN', 'Admin'),
        ('ACCOUNTS', 'Accounts'),
    ]
    
    name = models.CharField(max_length=50, choices=DEPARTMENT_CHOICES, unique=True)
    display_name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'dj_departments'
    
    def __str__(self):
        return self.display_name


class EvaluationQuestion(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='evaluation_questions')
    key = models.CharField(max_length=50)
    text = models.TextField()
    is_required = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        db_table = 'dj_evaluation_questions'
        ordering = ['department', 'order']
        unique_together = ['department', 'key']
    
    def __str__(self):
        return f"{self.department.name} - {self.key}"
