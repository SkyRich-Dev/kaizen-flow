from django.urls import path
from .views import (
    KaizenRequestListView, KaizenRequestDetailView,
    submit_request, my_requests, pending_approvals, get_by_request_id
)

urlpatterns = [
    path('', KaizenRequestListView.as_view(), name='kaizen_list'),
    path('<int:pk>/', KaizenRequestDetailView.as_view(), name='kaizen_detail'),
    path('<int:pk>/submit/', submit_request, name='kaizen_submit'),
    path('my/', my_requests, name='my_requests'),
    path('pending/', pending_approvals, name='pending_approvals'),
    path('by-request-id/<str:request_id>/', get_by_request_id, name='kaizen_by_request_id'),
]
