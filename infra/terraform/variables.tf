variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-southeast-1"
}

variable "ami_id" {
  description = "AMI ID for Ubuntu 22.04 LTS in ap-southeast-1"
  type        = string
  default     = "ami-0aebd6a41cf6ab2eb"
}

# Domain name will be configured during SSL setup with the setup-ssl.sh script

variable "postgres_admin_password" {
  description = "Password for PostgreSQL admin user (postgres)"
  type        = string
  sensitive   = true
  default     = "your_secure_admin_password_here"
}

variable "postgres_app_user" {
  description = "Username for PostgreSQL application user"
  type        = string
  default     = "matcha_user"
}

variable "postgres_app_password" {
  description = "Password for PostgreSQL application user"
  type        = string
  sensitive   = true
  default     = "matcha_app_password"
}

variable "postgres_database" {
  description = "Name of the PostgreSQL database for the application"
  type        = string
  default     = "matcha_db"
}