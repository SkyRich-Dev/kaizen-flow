from django.urls import path
from .views import (
    own_manager_decision, own_hod_decision, manager_evaluation,
    cross_hod_evaluation, agm_decision, gm_decision,
    own_manager_decision_by_request_id, own_hod_decision_by_request_id, 
    manager_evaluation_by_request_id,
    cross_hod_evaluation_by_request_id, agm_decision_by_request_id,
    gm_decision_by_request_id
)

urlpatterns = [
    path('kaizen/<int:pk>/own-manager/', own_manager_decision, name='own_manager_decision'),
    path('kaizen/<int:pk>/own-hod/', own_hod_decision, name='own_hod_decision'),
    path('kaizen/<int:pk>/manager/', manager_evaluation, name='manager_evaluation'),
    path('kaizen/<int:pk>/cross-hod/', cross_hod_evaluation, name='cross_hod_evaluation'),
    path('kaizen/<int:pk>/agm/', agm_decision, name='agm_decision'),
    path('kaizen/<int:pk>/gm/', gm_decision, name='gm_decision'),
    path('kaizen/by-request-id/<str:request_id>/own-manager/', own_manager_decision_by_request_id, name='own_manager_decision_by_request_id'),
    path('kaizen/by-request-id/<str:request_id>/own-hod/', own_hod_decision_by_request_id, name='own_hod_decision_by_request_id'),
    path('kaizen/by-request-id/<str:request_id>/manager/', manager_evaluation_by_request_id, name='manager_evaluation_by_request_id'),
    path('kaizen/by-request-id/<str:request_id>/cross-hod/', cross_hod_evaluation_by_request_id, name='cross_hod_evaluation_by_request_id'),
    path('kaizen/by-request-id/<str:request_id>/agm/', agm_decision_by_request_id, name='agm_decision_by_request_id'),
    path('kaizen/by-request-id/<str:request_id>/gm/', gm_decision_by_request_id, name='gm_decision_by_request_id'),
]
