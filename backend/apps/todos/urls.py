from django.urls import path

from apps.todos import views

urlpatterns = [
    path("student/todos", views.TodoListCreateView.as_view()),
    path("student/todos/<str:todo_id>", views.TodoDetailView.as_view()),
]
