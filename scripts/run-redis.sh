#!/bin/bash

# Script to run Redis container using docker-compose
# This script will start Redis from docker-compose.dev.yaml

echo "🚀 Starting Redis container..."

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Navigate to project root directory
cd "$(dirname "$0")/.."

# Start Redis container
echo "📦 Starting Redis container..."
docker-compose -f docker-compose.dev.yaml up -d redis

# Check if container started successfully
if [ $? -eq 0 ]; then
    echo "✅ Redis container started successfully!"
    echo "📍 Redis is running on localhost:6379"
    echo ""
    echo "🔍 To check Redis status:"
    echo "   docker-compose -f docker-compose.dev.yaml ps redis"
    echo ""
    echo "📊 To view Redis logs:"
    echo "   docker-compose -f docker-compose.dev.yaml logs redis"
    echo ""
    echo "🔗 To connect to Redis CLI:"
    echo "   docker exec -it matcha-redis redis-cli"
    echo ""
    echo "🛑 To stop Redis:"
    echo "   docker-compose -f docker-compose.dev.yaml stop redis"
else
    echo "❌ Failed to start Redis container"
    exit 1
fi 