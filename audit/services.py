import smtplib
import ssl
import json
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.conf import settings
from .models import NotificationSetting, AuditLog


class EmailNotificationService:
    """Service for sending email notifications."""
    
    @staticmethod
    def is_enabled():
        """Check if email notifications are enabled."""
        try:
            setting = NotificationSetting.objects.get(channel='EMAIL')
            return setting.enabled and bool(setting.config)
        except NotificationSetting.DoesNotExist:
            return False
    
    @staticmethod
    def get_config():
        """Get email configuration."""
        try:
            setting = NotificationSetting.objects.get(channel='EMAIL')
            return setting.config if setting.enabled else None
        except NotificationSetting.DoesNotExist:
            return None
    
    @classmethod
    def send_email(cls, to_email, subject, body, html_body=None):
        """Send an email notification."""
        if not cls.is_enabled():
            return {'success': False, 'error': 'Email notifications are disabled'}
        
        config = cls.get_config()
        if not config:
            return {'success': False, 'error': 'Email configuration not found'}
        
        try:
            smtp_host = config.get('smtp_host', '')
            smtp_port = int(config.get('smtp_port', 587))
            sender_email = config.get('sender_email', '')
            sender_name = config.get('sender_name', 'KaizenFlow')
            username = config.get('username', '')
            password = config.get('password', '')
            use_tls = config.get('use_tls', True)
            
            message = MIMEMultipart('alternative')
            message['Subject'] = subject
            message['From'] = f"{sender_name} <{sender_email}>"
            message['To'] = to_email
            
            part1 = MIMEText(body, 'plain')
            message.attach(part1)
            
            if html_body:
                part2 = MIMEText(html_body, 'html')
                message.attach(part2)
            
            if use_tls:
                context = ssl.create_default_context()
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls(context=context)
                    server.login(username, password)
                    server.sendmail(sender_email, to_email, message.as_string())
            else:
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.login(username, password)
                    server.sendmail(sender_email, to_email, message.as_string())
            
            return {'success': True, 'message': f'Email sent to {to_email}'}
        
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @classmethod
    def test_connection(cls, to_email):
        """Test email connection by sending a test email."""
        return cls.send_email(
            to_email=to_email,
            subject='KaizenFlow - Test Email',
            body='This is a test email from KaizenFlow notification system. If you received this, your email configuration is working correctly.',
            html_body='<h2>KaizenFlow Test Email</h2><p>This is a test email from KaizenFlow notification system.</p><p>If you received this, your email configuration is working correctly.</p>'
        )


class WhatsAppNotificationService:
    """Service for sending WhatsApp notifications."""
    
    @staticmethod
    def is_enabled():
        """Check if WhatsApp notifications are enabled."""
        try:
            setting = NotificationSetting.objects.get(channel='WHATSAPP')
            return setting.enabled and bool(setting.config)
        except NotificationSetting.DoesNotExist:
            return False
    
    @staticmethod
    def get_config():
        """Get WhatsApp configuration."""
        try:
            setting = NotificationSetting.objects.get(channel='WHATSAPP')
            return setting.config if setting.enabled else None
        except NotificationSetting.DoesNotExist:
            return None
    
    @classmethod
    def send_message(cls, to_number, message):
        """Send a WhatsApp message."""
        if not cls.is_enabled():
            return {'success': False, 'error': 'WhatsApp notifications are disabled'}
        
        config = cls.get_config()
        if not config:
            return {'success': False, 'error': 'WhatsApp configuration not found'}
        
        try:
            provider = config.get('provider', 'twilio')
            api_url = config.get('api_url', '')
            account_sid = config.get('account_sid', '')
            auth_token = config.get('auth_token', '')
            sender_number = config.get('sender_number', '')
            default_country_code = config.get('default_country_code', '+91')
            
            if not to_number.startswith('+'):
                to_number = default_country_code + to_number
            
            if provider.lower() == 'twilio':
                return cls._send_via_twilio(api_url, account_sid, auth_token, sender_number, to_number, message)
            elif provider.lower() == 'meta':
                return cls._send_via_meta(api_url, auth_token, sender_number, to_number, message)
            else:
                return cls._send_via_generic(api_url, auth_token, sender_number, to_number, message)
        
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def _send_via_twilio(api_url, account_sid, auth_token, sender_number, to_number, message):
        """Send message via Twilio."""
        try:
            url = api_url or f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
            
            response = requests.post(
                url,
                auth=(account_sid, auth_token),
                data={
                    'From': f'whatsapp:{sender_number}',
                    'To': f'whatsapp:{to_number}',
                    'Body': message
                },
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                return {'success': True, 'message': f'WhatsApp message sent to {to_number}'}
            else:
                return {'success': False, 'error': f'Twilio error: {response.text}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def _send_via_meta(api_url, auth_token, sender_number, to_number, message):
        """Send message via Meta Cloud API."""
        try:
            url = api_url or f"https://graph.facebook.com/v17.0/{sender_number}/messages"
            
            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'messaging_product': 'whatsapp',
                'to': to_number.replace('+', ''),
                'type': 'text',
                'text': {'body': message}
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            if response.status_code in [200, 201]:
                return {'success': True, 'message': f'WhatsApp message sent to {to_number}'}
            else:
                return {'success': False, 'error': f'Meta API error: {response.text}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def _send_via_generic(api_url, auth_token, sender_number, to_number, message):
        """Send message via generic API."""
        try:
            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'from': sender_number,
                'to': to_number,
                'message': message
            }
            
            response = requests.post(api_url, headers=headers, json=payload, timeout=30)
            
            if response.status_code in [200, 201]:
                return {'success': True, 'message': f'WhatsApp message sent to {to_number}'}
            else:
                return {'success': False, 'error': f'API error: {response.text}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @classmethod
    def test_connection(cls, to_number):
        """Test WhatsApp connection by sending a test message."""
        return cls.send_message(
            to_number=to_number,
            message='This is a test message from KaizenFlow notification system. If you received this, your WhatsApp configuration is working correctly.'
        )


class NotificationService:
    """Unified notification service that handles all channels."""
    
    @classmethod
    def send_notification(cls, user, subject, message, html_message=None):
        """Send notification via all enabled channels."""
        results = {}
        
        if EmailNotificationService.is_enabled() and user.email:
            results['email'] = EmailNotificationService.send_email(
                to_email=user.email,
                subject=subject,
                body=message,
                html_body=html_message
            )
        
        if WhatsAppNotificationService.is_enabled() and hasattr(user, 'phone_number') and user.phone_number:
            results['whatsapp'] = WhatsAppNotificationService.send_message(
                to_number=user.phone_number,
                message=f"{subject}\n\n{message}"
            )
        
        return results
