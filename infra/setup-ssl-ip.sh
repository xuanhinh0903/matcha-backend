#!/bin/bash

# Temporary SSL setup using IP address for testing
# This is NOT recommended for production - use only for testing

set -e

# Configuration
SERVER_IP="3.1.220.134"
EMAIL="buixuanhinhxtnd@gmail.com"
APP_PORT="3030"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning "⚠️  This script sets up SSL using IP address - NOT recommended for production!"
print_warning "⚠️  Use this ONLY for testing until your DNS is configured!"

print_status "Setting up temporary SSL for IP: $SERVER_IP"

# Install nginx if not present
if ! command -v nginx &> /dev/null; then
    print_status "Installing nginx..."
    sudo apt-get update
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi

# Create basic nginx config for IP access
print_status "Creating nginx configuration for IP access..."
sudo tee /etc/nginx/sites-available/ip-app > /dev/null <<EOF
server {
    listen 80;
    server_name $SERVER_IP;
    
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /health {
        proxy_pass http://localhost:$APP_PORT/health;
        access_log off;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/ip-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
sudo nginx -t && sudo systemctl reload nginx

print_status "✅ Nginx configured for IP access"
print_status "🌐 Your app is now accessible at: http://$SERVER_IP"
print_status "💓 Health check: http://$SERVER_IP/health"

print_warning ""
print_warning "🔧 To get HTTPS with proper domain:"
print_warning "   1. Configure DNS records for matchat-app.xyz to point to $SERVER_IP"
print_warning "   2. Wait 5-15 minutes for DNS propagation"
print_warning "   3. Run: nslookup matchat-app.xyz (should return $SERVER_IP)"
print_warning "   4. Then run the original setup-ssl-matchat.sh script"
print_warning "" 