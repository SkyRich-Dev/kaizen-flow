from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    kaizen_request = models.ForeignKey(
        'kaizen_requests.KaizenRequest',
        on_delete=models.CASCADE,
        related_name='audit_logs',
        null=True,
        blank=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=100)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'dj_audit_logs'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.action} by {self.user} at {self.created_at}"


class NotificationSetting(models.Model):
    CHANNEL_CHOICES = [
        ('EMAIL', 'Email'),
        ('WHATSAPP', 'WhatsApp'),
    ]
    
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, unique=True)
    enabled = models.BooleanField(default=False)
    config = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='notification_settings_created'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='notification_settings_updated'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'dj_notification_settings'
    
    def __str__(self):
        return f"{self.channel} - {'Enabled' if self.enabled else 'Disabled'}"
    
    def get_masked_config(self):
        """Return config with sensitive values masked."""
        masked = {}
        sensitive_keys = ['password', 'auth_token', 'api_key', 'app_password']
        for key, value in self.config.items():
            if any(s in key.lower() for s in sensitive_keys) and value:
                masked[key] = '••••••••' + str(value)[-4:] if len(str(value)) > 4 else '••••••••'
            else:
                masked[key] = value
        return masked


class Setting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'dj_settings'
    
    def __str__(self):
        return self.key
