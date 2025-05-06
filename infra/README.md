# Matcha Backend Infrastructure

This directory contains the Terraform configuration for deploying the Matcha backend infrastructure on AWS.

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) installed (v1.5+)
- [AWS CLI](https://aws.amazon.com/cli/) installed and configured with appropriate credentials
- S3 bucket for Terraform state storage named `matcha-terraform-toandev`
- DynamoDB table for state locking named `matcha-terraform-toandev-locks`

## Resources Created

The following resources will be created in AWS:

- **VPC and Network Infrastructure**:

  - VPC with CIDR block 10.0.0.0/16
  - Public subnets for resources that need internet access
  - Private subnets for backend resources
  - Internet Gateway for public internet access
  - Route tables for public and private subnets

- **ECS Fargate (Cost Optimized)**:

  - Cluster: matcha-backend-cluster
  - Service: matcha-backend-service using **Fargate Spot** for cost savings
  - Task Definition: 256 CPU units (0.25 vCPU), 512MB memory
  - Tasks run in public subnets with public IPs (eliminating NAT costs)

- **Application Load Balancer**:

  - Name: matcha-alb
  - Listener on port 80
  - Target group for the Fargate service

- **Security Groups**:

  - ALB Security Group (matcha-alb-sg)
  - ECS Security Group (matcha-ecs-sg)
  - Database Security Group (matcha-db-sg)

- **RDS PostgreSQL Database (Free Tier)**:

  - Instance Class: db.t3.micro (Free Tier eligible)
  - Engine: PostgreSQL 16.4
  - Storage: 20GB gp2 (Free Tier eligible)
  - Parameter Group: Custom PostgreSQL parameter group with PostGIS extensions
  - Tags: Name = matcha-postgres-db
  - Free Tier optimizations: Single AZ, minimal backup retention

- **CloudWatch Logs**:

  - Log group for ECS tasks with 1-day retention (minimizes costs)

- **ECR Repository**:
  - Repository for Docker images: matcha-backend

## Setup and Deployment

### 1. Initialize Terraform State Storage

Before running the Terraform configuration, you need to create an S3 bucket and DynamoDB table for state management:

```bash
# Create S3 bucket for Terraform state
aws s3api create-bucket --bucket matcha-terraform-toandev --region ap-southeast-1 --create-bucket-configuration LocationConstraint=ap-southeast-1

# Enable versioning on the bucket
aws s3api put-bucket-versioning --bucket matcha-terraform-toandev --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name matcha-terraform-toandev-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-1
```

### 2. Create a `terraform.tfvars` File

Create a file named `terraform.tfvars` in the terraform directory with your specific values:

```hcl
aws_region    = "ap-southeast-1"
db_username   = "postgres"
db_password   = "your-secure-password"
```

### 3. Initialize and Apply Terraform Configuration

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### 4. Configure GitHub Secrets

After applying the Terraform configuration, add the following secrets to your GitHub repository:

- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_REGION`: The AWS region where resources are deployed
- `ECR_REPOSITORY_URL`: The ECR repository URL (from Terraform output)
- `ECS_CLUSTER_NAME`: The ECS cluster name (from Terraform output)
- `ECS_SERVICE_NAME`: The ECS service name (from Terraform output)

## Cost Optimization

This infrastructure has been optimized for minimal AWS costs by:

1. Using **Fargate Spot** for up to 70% savings on compute
2. Placing tasks in public subnets to eliminate NAT gateway/instance costs
3. Staying within RDS free tier limits with db.t3.micro and 20GB gp2 storage
4. Setting CloudWatch log retention to 1 day to minimize storage costs
5. Right-sizing Fargate tasks to minimal viable resources (256 CPU, 512MB RAM)

## Updating Infrastructure

To update the infrastructure, make changes to the Terraform files and run:

```bash
terraform plan
terraform apply
```

## Cleaning Up

To remove all resources created by this configuration:

```bash
terraform destroy
```

> **Note:** This will delete all resources including the database and any stored data.
