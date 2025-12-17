#!/bin/bash

echo "Starting Django backend on port 8000..."
python manage.py runserver 0.0.0.0:8000 &
DJANGO_PID=$!

echo "Waiting for Django to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/api/health/ > /dev/null 2>&1; then
        echo "Django is ready!"
        break
    fi
    sleep 1
done

echo "Starting Node.js/Vite on port 5000..."
NODE_ENV=development npx tsx server/index.ts

kill $DJANGO_PID 2>/dev/null
