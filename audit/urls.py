from django.urls import path
from .views import (
    AuditLogListView, get_settings, update_setting,
    get_notification_settings, save_email_settings, save_whatsapp_settings,
    test_email, test_whatsapp
)

urlpatterns = [
    path('logs/', AuditLogListView.as_view(), name='audit_logs'),
    path('settings/', get_settings, name='get_settings'),
    path('settings/update/', update_setting, name='update_setting'),
    path('settings/notifications/', get_notification_settings, name='notification_settings'),
    path('settings/notifications/email/', save_email_settings, name='save_email_settings'),
    path('settings/notifications/whatsapp/', save_whatsapp_settings, name='save_whatsapp_settings'),
    path('settings/notifications/test/email/', test_email, name='test_email'),
    path('settings/notifications/test/whatsapp/', test_whatsapp, name='test_whatsapp'),
]
