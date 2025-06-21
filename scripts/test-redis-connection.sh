#!/bin/bash

# Script to test Redis connection and basic operations

echo "🧪 Testing Redis connection..."

# Check if Redis container is running
if ! docker ps | grep -q matcha-redis; then
    echo "❌ Redis container is not running. Please start it first:"
    echo "   ./scripts/docker-run-redis.sh"
    exit 1
fi

echo "✅ Redis container is running"

# Test basic Redis operations
echo ""
echo "🔗 Testing Redis connection..."
docker exec -it matcha-redis redis-cli ping

echo ""
echo "📝 Testing Redis operations..."

# Test SET operation
echo "Setting key 'test:hello' to 'world'..."
docker exec -it matcha-redis redis-cli SET test:hello world

# Test GET operation
echo "Getting value for key 'test:hello'..."
docker exec -it matcha-redis redis-cli GET test:hello

# Test EXISTS operation
echo "Checking if key 'test:hello' exists..."
docker exec -it matcha-redis redis-cli EXISTS test:hello

# Test DEL operation
echo "Deleting key 'test:hello'..."
docker exec -it matcha-redis redis-cli DEL test:hello

# Test EXISTS after deletion
echo "Checking if key 'test:hello' still exists..."
docker exec -it matcha-redis redis-cli EXISTS test:hello

echo ""
echo "✅ Redis connection test completed successfully!"
echo ""
echo "🔍 To view all keys in Redis:"
echo "   docker exec -it matcha-redis redis-cli KEYS '*'"
echo ""
echo "📊 To view Redis info:"
echo "   docker exec -it matcha-redis redis-cli INFO" 