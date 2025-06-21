#!/bin/bash

# Exit on any error
set -e

# Configuration
ECR_REPO="555622622153.dkr.ecr.ap-southeast-1.amazonaws.com/matcha-app"
AWS_REGION="ap-southeast-1"
EC2_USER="ubuntu"

# Get EC2 public IP from terraform output
cd terraform
EC2_IP=$(terraform output -raw app_public_ip)
KEY_PATH="./matcha-key.pem"

echo "🚀 Starting deployment to EC2 instance: $EC2_IP"

# Build and push Docker image
echo "📦 Building and pushing Docker image..."
cd ..
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO
docker buildx build --platform linux/amd64 -t matcha-app:latest .
docker tag matcha-app:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# Deploy to EC2
echo "🚀 Deploying to EC2..."
ssh -i $KEY_PATH -o StrictHostKeyChecking=no $EC2_USER@$EC2_IP << 'ENDSSH'
# Pull latest image
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 555622622153.dkr.ecr.ap-southeast-1.amazonaws.com/matcha-app

# Stop and remove existing containers
docker-compose down

# Clean up resources
docker container prune -f
docker image prune -a -f
docker volume prune -f
docker network prune -f

# Pull and start new containers
docker pull 555622622153.dkr.ecr.ap-southeast-1.amazonaws.com/matcha-app:latest
docker-compose up -d

echo "✅ Deployment completed!"
ENDSSH

# Print logs
echo "📝 Fetching logs..."
ssh -i $KEY_PATH $EC2_USER@$EC2_IP "docker-compose logs -f" 