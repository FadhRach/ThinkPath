from rest_framework import serializers

from apps.todos.models import StudentTodo


class TodoSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentTodo
        fields = ["id", "title", "due_on", "done", "created_at", "done_at"]
        read_only_fields = ["id", "created_at", "done_at"]

    title = serializers.CharField(min_length=1, max_length=200, trim_whitespace=True)
