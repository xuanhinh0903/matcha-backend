# Minimal Terraform for Redis, Elasticsearch, and PostgreSQL (PostGIS)

provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true
  tags = { Name = "matcha-minimal-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone = data.aws_availability_zones.available.names[0]
  tags = { Name = "matcha-minimal-public-subnet" }
}

# Second subnet removed - not needed for simple nginx setup

data "aws_availability_zones" "available" {}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id
  tags = { Name = "matcha-minimal-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }
  tags = { Name = "matcha-minimal-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Simplified security group for EC2 instances
resource "aws_security_group" "open" {
  name        = "matcha-minimal-open-sg"
  description = "Allow HTTP, HTTPS, SSH and app port access"
  vpc_id      = aws_vpc.main.id

  # HTTP access
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH access
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # App port for direct access during setup
  ingress {
    from_port   = 3030
    to_port     = 3030
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all services within VPC to communicate
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "matcha-ec2-sg" }
}

# SSL will be handled by nginx + certbot on the EC2 instance

resource "aws_key_pair" "deployer" {
  key_name   = "matcha-minimal-key"
  public_key = file("${path.module}/matcha-key.pem.pub")
}

resource "aws_instance" "redis" {
  ami           = var.ami_id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.open.id]
  key_name      = aws_key_pair.deployer.key_name
  associate_public_ip_address = true
  user_data = <<-EOF
    #!/bin/bash
    sudo apt-get update
    sudo apt-get install -y redis-server
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
  EOF
  tags = { Name = "matcha-redis" }
}

resource "aws_instance" "elasticsearch" {
  ami           = var.ami_id
  instance_type = "t3.small"
  subnet_id     = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.open.id]
  key_name      = aws_key_pair.deployer.key_name
  associate_public_ip_address = true
  user_data = <<-EOF
    #!/bin/bash
    sudo apt-get update
    sudo apt-get install -y openjdk-11-jre wget
    wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.8.0-amd64.deb
    sudo dpkg -i elasticsearch-8.8.0-amd64.deb
    sudo systemctl enable elasticsearch
    sudo systemctl start elasticsearch
  EOF
  tags = { Name = "matcha-elasticsearch" }
}

resource "aws_instance" "postgres" {
  ami           = var.ami_id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.open.id]
  key_name      = aws_key_pair.deployer.key_name
  associate_public_ip_address = true
  user_data = <<-EOF
    #!/bin/bash
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib postgis
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
  EOF
  tags = { Name = "matcha-postgres" }
}

resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.open.id]
  key_name      = aws_key_pair.deployer.key_name
  associate_public_ip_address = true
  user_data = <<-EOF
    #!/bin/bash
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose
    sudo usermod -aG docker ubuntu
    newgrp docker
    # Optionally, clone your repo or pull your Docker image here
    # Example: docker run -d -p 3030:3030 <your-image>
  EOF
  tags = { Name = "matcha-app" }
}

output "redis_public_ip" {
  value = aws_instance.redis.public_ip
}
output "elasticsearch_public_ip" {
  value = aws_instance.elasticsearch.public_ip
}
output "postgres_public_ip" {
  value = aws_instance.postgres.public_ip
}
output "app_public_ip" {
  value = aws_instance.app.public_ip
}