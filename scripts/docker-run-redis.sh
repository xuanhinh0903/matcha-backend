#!/bin/bash

# Script to run Redis container using docker run
# This script will start Redis container directly with docker run

echo "🚀 Starting Redis container with docker run..."

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Stop and remove existing Redis container if it exists
echo "🧹 Cleaning up existing Redis container..."
docker stop matcha-redis 2>/dev/null || true
docker rm matcha-redis 2>/dev/null || true

# Create Redis data volume if it doesn't exist
echo "📦 Creating Redis data volume..."
docker volume create redis-data 2>/dev/null || true

# Run Redis container
echo "🐳 Starting Redis container..."
docker run -d \
  --name matcha-redis \
  --restart always \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:latest \
  redis-server --appendonly yes

# Check if container started successfully
if [ $? -eq 0 ]; then
    echo "✅ Redis container started successfully!"
    echo "📍 Redis is running on localhost:6379"
    echo "💾 Data is persisted in redis-data volume"
    echo ""
    echo "🔍 To check Redis status:"
    echo "   docker ps | grep matcha-redis"
    echo ""
    echo "📊 To view Redis logs:"
    echo "   docker logs matcha-redis"
    echo ""
    echo "🔗 To connect to Redis CLI:"
    echo "   docker exec -it matcha-redis redis-cli"
    echo ""
    echo "🧪 To test Redis connection:"
    echo "   docker exec -it matcha-redis redis-cli ping"
    echo ""
    echo "🛑 To stop Redis:"
    echo "   docker stop matcha-redis"
    echo ""
    echo "🗑️ To remove Redis container:"
    echo "   docker rm matcha-redis"
else
    echo "❌ Failed to start Redis container"
    exit 1
fi 