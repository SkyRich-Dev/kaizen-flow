from rest_framework import generics
from .models import Department
from .serializers import DepartmentSerializer


class DepartmentListView(generics.ListAPIView):
    queryset = Department.objects.prefetch_related('evaluation_questions').all()
    serializer_class = DepartmentSerializer


class DepartmentDetailView(generics.RetrieveAPIView):
    queryset = Department.objects.prefetch_related('evaluation_questions').all()
    serializer_class = DepartmentSerializer
