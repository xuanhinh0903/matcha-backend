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