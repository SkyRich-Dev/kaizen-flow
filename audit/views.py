from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from .models import AuditLog, Setting, NotificationSetting
from .services import EmailNotificationService, WhatsAppNotificationService


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    request_id = serializers.CharField(source='kaizen_request.request_id', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = ['id', 'kaizen_request', 'request_id', 'user', 'user_name', 'action', 'details', 'created_at']


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = AuditLog.objects.select_related('user', 'kaizen_request').all()
        
        request_id = self.request.query_params.get('request_id')
        if request_id:
            queryset = queryset.filter(kaizen_request__request_id=request_id)
        
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        return queryset[:100]


class SettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setting
        fields = ['key', 'value', 'updated_at']


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_settings(request):
    import json
    settings = Setting.objects.all()
    flat_settings = {}
    
    for s in settings:
        # Try to parse JSON stored values back to their original types
        try:
            flat_settings[s.key] = json.loads(s.value) if s.value else s.value
        except (json.JSONDecodeError, TypeError):
            flat_settings[s.key] = s.value
    
    # Reconstruct nested structure from flat key-value pairs
    result = {}
    for key, value in flat_settings.items():
        parts = key.split('.')
        current = result
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_setting(request):
    if request.user.role != 'ADMIN':
        return Response({'error': 'Unauthorized'}, status=403)
    
    key = request.data.get('key')
    value = request.data.get('value')
    
    if not key:
        return Response({'error': 'Key is required'}, status=400)
    
    # Convert value to JSON string for consistent storage
    import json
    if value is not None and not isinstance(value, str):
        value = json.dumps(value)
    
    setting, _ = Setting.objects.update_or_create(
        key=key,
        defaults={'value': value}
    )
    
    return Response(SettingSerializer(setting).data)


class NotificationSettingSerializer(serializers.ModelSerializer):
    masked_config = serializers.SerializerMethodField()
    updated_by_name = serializers.CharField(source='updated_by.get_full_name', read_only=True)
    
    class Meta:
        model = NotificationSetting
        fields = ['id', 'channel', 'enabled', 'config', 'masked_config', 'updated_by_name', 'updated_at']
        extra_kwargs = {'config': {'write_only': True}}
    
    def get_masked_config(self, obj):
        return obj.get_masked_config()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notification_settings(request):
    """Get all notification settings (Admin only)."""
    if request.user.role != 'ADMIN':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    email_setting, _ = NotificationSetting.objects.get_or_create(
        channel='EMAIL',
        defaults={'enabled': False, 'config': {}}
    )
    whatsapp_setting, _ = NotificationSetting.objects.get_or_create(
        channel='WHATSAPP',
        defaults={'enabled': False, 'config': {}}
    )
    
    return Response({
        'email': {
            'enabled': email_setting.enabled,
            'config': email_setting.get_masked_config(),
            'updated_at': email_setting.updated_at,
            'updated_by': email_setting.updated_by.get_full_name() if email_setting.updated_by else None
        },
        'whatsapp': {
            'enabled': whatsapp_setting.enabled,
            'config': whatsapp_setting.get_masked_config(),
            'updated_at': whatsapp_setting.updated_at,
            'updated_by': whatsapp_setting.updated_by.get_full_name() if whatsapp_setting.updated_by else None
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_email_settings(request):
    """Save email notification settings (Admin only)."""
    if request.user.role != 'ADMIN':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    enabled = request.data.get('enabled', False)
    config = request.data.get('config', {})
    
    setting, created = NotificationSetting.objects.get_or_create(
        channel='EMAIL',
        defaults={'enabled': False, 'config': {}}
    )
    
    old_enabled = setting.enabled
    old_config = setting.config.copy()
    
    if config:
        existing_config = setting.config or {}
        for key, value in config.items():
            if value is not None and not (isinstance(value, str) and value.startswith('••••')):
                existing_config[key] = value
        setting.config = existing_config
    
    setting.enabled = enabled
    setting.updated_by = request.user
    if created:
        setting.created_by = request.user
    setting.save()
    
    AuditLog.objects.create(
        user=request.user,
        action='EMAIL_SETTINGS_UPDATED',
        details={
            'enabled_changed': old_enabled != enabled,
            'old_enabled': old_enabled,
            'new_enabled': enabled,
            'config_updated': old_config != setting.config
        },
        ip_address=request.META.get('REMOTE_ADDR')
    )
    
    return Response({
        'success': True,
        'enabled': setting.enabled,
        'config': setting.get_masked_config()
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_whatsapp_settings(request):
    """Save WhatsApp notification settings (Admin only)."""
    if request.user.role != 'ADMIN':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    enabled = request.data.get('enabled', False)
    config = request.data.get('config', {})
    
    setting, created = NotificationSetting.objects.get_or_create(
        channel='WHATSAPP',
        defaults={'enabled': False, 'config': {}}
    )
    
    old_enabled = setting.enabled
    old_config = setting.config.copy()
    
    if config:
        existing_config = setting.config or {}
        for key, value in config.items():
            if value is not None and not (isinstance(value, str) and value.startswith('••••')):
                existing_config[key] = value
        setting.config = existing_config
    
    setting.enabled = enabled
    setting.updated_by = request.user
    if created:
        setting.created_by = request.user
    setting.save()
    
    AuditLog.objects.create(
        user=request.user,
        action='WHATSAPP_SETTINGS_UPDATED',
        details={
            'enabled_changed': old_enabled != enabled,
            'old_enabled': old_enabled,
            'new_enabled': enabled,
            'config_updated': old_config != setting.config
        },
        ip_address=request.META.get('REMOTE_ADDR')
    )
    
    return Response({
        'success': True,
        'enabled': setting.enabled,
        'config': setting.get_masked_config()
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_email(request):
    """Test email notification (Admin only)."""
    if request.user.role != 'ADMIN':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    to_email = request.data.get('to_email', request.user.email)
    
    if not to_email:
        return Response({'error': 'Email address required'}, status=status.HTTP_400_BAD_REQUEST)
    
    result = EmailNotificationService.test_connection(to_email)
    
    AuditLog.objects.create(
        user=request.user,
        action='EMAIL_TEST_SENT',
        details={'to_email': to_email, 'success': result.get('success', False)},
        ip_address=request.META.get('REMOTE_ADDR')
    )
    
    if result.get('success'):
        return Response(result)
    else:
        return Response(result, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_whatsapp(request):
    """Test WhatsApp notification (Admin only)."""
    if request.user.role != 'ADMIN':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    to_number = request.data.get('to_number')
    
    if not to_number:
        return Response({'error': 'Phone number required'}, status=status.HTTP_400_BAD_REQUEST)
    
    result = WhatsAppNotificationService.test_connection(to_number)
    
    AuditLog.objects.create(
        user=request.user,
        action='WHATSAPP_TEST_SENT',
        details={'to_number': to_number, 'success': result.get('success', False)},
        ip_address=request.META.get('REMOTE_ADDR')
    )
    
    if result.get('success'):
        return Response(result)
    else:
        return Response(result, status=status.HTTP_400_BAD_REQUEST)
