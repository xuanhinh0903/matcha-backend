#!/bin/bash
# Script to store Terraform outputs in SSM Parameter Store

# Set variables
REGION=${AWS_REGION:-"ap-southeast-1"}

# Run terraform output
echo "Retrieving Terraform outputs..."
ALB_DNS_NAME=$(terraform output -raw alb_dns_name)
ECR_REPO_URL=$(terraform output -raw ecr_repository_url)
ECS_CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
ECS_SERVICE_NAME=$(terraform output -raw ecs_service_name)
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)

# Create or update SSM parameters
echo "Storing outputs in SSM Parameter Store..."

# ALB DNS name
aws ssm put-parameter \
  --name "/matcha/alb/dns-name" \
  --value "${ALB_DNS_NAME}" \
  --type "String" \
  --overwrite \
  --region $REGION

# ECR Repository URL
aws ssm put-parameter \
  --name "/matcha/ecr/repository-url" \
  --value "${ECR_REPO_URL}" \
  --type "String" \
  --overwrite \
  --region $REGION

# ECS Cluster name
aws ssm put-parameter \
  --name "/matcha/ecs/cluster-name" \
  --value "${ECS_CLUSTER_NAME}" \
  --type "String" \
  --overwrite \
  --region $REGION

# ECS Service name
aws ssm put-parameter \
  --name "/matcha/ecs/service-name" \
  --value "${ECS_SERVICE_NAME}" \
  --type "String" \
  --overwrite \
  --region $REGION

# Task family
aws ssm put-parameter \
  --name "/matcha/ecs/task-family" \
  --value "matcha-backend" \
  --type "String" \
  --overwrite \
  --region $REGION

# RDS endpoint
aws ssm put-parameter \
  --name "/matcha/rds/endpoint" \
  --value "${RDS_ENDPOINT}" \
  --type "String" \
  --overwrite \
  --region $REGION

echo "All Terraform outputs stored in SSM Parameter Store successfully!"