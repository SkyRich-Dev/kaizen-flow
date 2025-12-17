from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import KaizenRequest
from .serializers import (
    KaizenRequestSerializer, KaizenRequestCreateSerializer, 
    KaizenRequestDetailSerializer
)


class KaizenRequestListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = KaizenRequest.objects.select_related('department', 'initiator').order_by('-created_at')
        
        if user.role == 'INITIATOR':
            return queryset.filter(initiator=user)
        elif user.role == 'MANAGER':
            return queryset.filter(
                Q(status='PENDING_OWN_MANAGER', department=user.department) |
                Q(status='PENDING_CROSS_MANAGER') |
                Q(status='APPROVED') |
                Q(status='REJECTED') |
                Q(initiator=user)
            )
        elif user.role == 'HOD':
            return queryset.filter(
                Q(status='PENDING_OWN_HOD', department=user.department) |
                Q(status='PENDING_CROSS_HOD') |
                Q(status='APPROVED') |
                Q(status='REJECTED') |
                Q(initiator=user)
            )
        elif user.role == 'AGM':
            return queryset.filter(
                Q(status='PENDING_AGM') |
                Q(status='PENDING_GM') |
                Q(status='APPROVED') |
                Q(status='REJECTED') |
                Q(initiator=user)
            )
        elif user.role == 'GM':
            return queryset.filter(
                Q(status='PENDING_GM') |
                Q(status='APPROVED') |
                Q(status='REJECTED') |
                Q(initiator=user)
            )
        elif user.role == 'ADMIN':
            return queryset.all()
        
        return queryset.none()
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return KaizenRequestCreateSerializer
        return KaizenRequestSerializer


class KaizenRequestDetailView(generics.RetrieveUpdateAPIView):
    queryset = KaizenRequest.objects.select_related('department', 'initiator')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return KaizenRequestCreateSerializer
        return KaizenRequestDetailSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_request(request, pk):
    try:
        kaizen = KaizenRequest.objects.get(pk=pk, initiator=request.user)
        if kaizen.status != 'DRAFT':
            return Response({'error': 'Request already submitted'}, status=status.HTTP_400_BAD_REQUEST)
        
        kaizen.status = 'PENDING_OWN_MANAGER'
        kaizen.current_stage = 'OWN_MANAGER'
        kaizen.save()
        
        return Response(KaizenRequestSerializer(kaizen).data)
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_requests(request):
    requests = KaizenRequest.objects.filter(initiator=request.user)
    return Response(KaizenRequestSerializer(requests, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_approvals(request):
    user = request.user
    queryset = KaizenRequest.objects.select_related('department', 'initiator')
    
    if user.role == 'HOD' and user.department:
        pending = queryset.filter(
            Q(status='PENDING_OWN_HOD', department=user.department) |
            Q(status='PENDING_CROSS_HOD')
        )
    elif user.role == 'MANAGER' and user.department:
        pending = queryset.filter(
            Q(status='PENDING_OWN_MANAGER', department=user.department) |
            Q(status='PENDING_CROSS_MANAGER')
        )
    elif user.role == 'AGM':
        pending = queryset.filter(status='PENDING_AGM')
    elif user.role == 'GM':
        pending = queryset.filter(status='PENDING_GM')
    else:
        pending = queryset.none()
    
    return Response(KaizenRequestSerializer(pending, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_by_request_id(request, request_id):
    try:
        kaizen = KaizenRequest.objects.select_related('department', 'initiator').get(request_id=request_id)
        return Response(KaizenRequestDetailSerializer(kaizen).data)
    except KaizenRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
