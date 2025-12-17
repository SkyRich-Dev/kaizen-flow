from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('INITIATOR', 'Initiator'),
        ('MANAGER', 'Manager'),
        ('HOD', 'Head of Department'),
        ('AGM', 'Assistant General Manager'),
        ('GM', 'General Manager'),
        ('ADMIN', 'Administrator'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='INITIATOR')
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    is_hod = models.BooleanField(default=False)
    is_manager = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'dj_users'
    
    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"
