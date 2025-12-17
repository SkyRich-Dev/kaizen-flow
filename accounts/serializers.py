from rest_framework import serializers
from .models import User
from departments.models import Department


class DepartmentField(serializers.Field):
    """Custom field that accepts department name string and returns Department object."""
    
    def to_representation(self, value):
        return value.name if value else None
    
    def to_internal_value(self, data):
        if not data:
            return None
        try:
            return Department.objects.get(name=data)
        except Department.DoesNotExist:
            raise serializers.ValidationError(f"Department '{data}' does not exist")


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.display_name', read_only=True)
    department = DepartmentField(required=False, allow_null=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'department', 'department_name', 'is_hod', 'is_manager', 'is_active'
        ]
        read_only_fields = ['id', 'username', 'email']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    department = DepartmentField(required=False, allow_null=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'first_name', 'last_name',
            'role', 'department', 'is_hod', 'is_manager'
        ]
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False)
    department = DepartmentField(required=False, allow_null=True)
    
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'role', 'department', 'is_hod', 'is_manager', 'is_active', 'password']
    
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    
    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid credentials')
        
        if not user.check_password(password):
            raise serializers.ValidationError('Invalid credentials')
        
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled')
        
        data['user'] = user
        return data
