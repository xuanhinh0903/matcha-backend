#!/bin/bash

# SSL Setup for AWS EC2 Public DNS with Certbot
# This will work immediately since AWS DNS is already configured

set -e

# Configuration
AWS_DOMAIN="matcha-app.xyz"
EMAIL="buixuanhinhxtnd@gmail.com"
APP_PORT="3030"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${PURPLE}[SUCCESS]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_error "Please run this script as ubuntu user, not root!"
    exit 1
fi

echo ""
echo "🚀 Setting up HTTPS for AWS EC2 Public DNS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_status "🌐 Domain: $AWS_DOMAIN"
print_status "📧 Email: $EMAIL"
print_status "🔌 App Port: $APP_PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Pre-flight checks
print_step "1/7 - Running pre-flight checks..."

# Check if app is running
if curl -s http://localhost:$APP_PORT/health > /dev/null; then
    print_success "✅ App is responding on port $APP_PORT"
else
    print_warning "⚠️  App may not be responding on port $APP_PORT"
    read -p "Continue anyway? (y/n): " continue_setup
    if [[ $continue_setup != "y" ]]; then
        exit 1
    fi
fi

# Verify DNS resolution
print_status "Checking DNS resolution for AWS domain..."
if nslookup "$AWS_DOMAIN" | grep -q "47.130.104.223"; then
    print_success "✅ DNS resolution working: $AWS_DOMAIN → 47.130.104.223"
else
    print_error "❌ DNS resolution failed for $AWS_DOMAIN"
    exit 1
fi

# Update system
print_step "2/7 - Updating system packages..."
sudo apt-get update -y

# Install prerequisites
print_step "3/7 - Installing prerequisites..."
sudo apt-get install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates

# Install nginx
print_step "4/7 - Installing and configuring nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    print_success "✅ Nginx installed"
else
    print_status "Nginx already installed"
fi

# Install certbot
print_step "5/7 - Installing certbot..."
if ! command -v certbot &> /dev/null; then
    sudo apt-get install -y snapd
    sudo systemctl enable snapd
    sudo systemctl start snapd
    
    # Wait for snap to be ready
    sleep 5
    
    print_status "Installing snap core..."
    sudo snap install core 2>/dev/null || true
    sudo snap refresh core 2>/dev/null || true
    
    print_status "Installing certbot..."
    sudo snap install --classic certbot
    sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    
    print_success "✅ Certbot installed: $(certbot --version)"
else
    print_status "Certbot already installed: $(certbot --version)"
fi

# Create new nginx configuration
print_step "6/7 - Creating new nginx configuration..."

# Backup original nginx configuration
print_status "Backing up original nginx configuration..."
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Create new nginx.conf with proper configuration for Ubuntu EC2
print_status "Creating new nginx.conf for Ubuntu EC2..."
sudo tee /etc/nginx/nginx.conf > /dev/null <<NGINX_CONF_EOF
# Global nginx configuration for Ubuntu EC2
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
    # multi_accept on;
}

http {
    ##
    # Basic Settings
    ##
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Fix for long domain names (AWS EC2 domains)
    server_names_hash_bucket_size 128;
    
    # server_tokens off;
    # server_name_in_redirect off;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ##
    # SSL Settings
    ##
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    ##
    # Logging Settings
    ##
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    ##
    # Gzip Settings
    ##
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    ##
    # Virtual Host Configs
    ##
    # Initial HTTP configuration for SSL certificate generation
    server {
        listen 80;
        server_name $AWS_DOMAIN;
        
        # ACME challenge location for Let's Encrypt
        location /.well-known/acme-challenge/ {
            root /var/www/html;
            try_files \$uri =404;
        }
        
        # Proxy all other requests to your app
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
            
            # Enhanced timeout settings
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
        
        # Health check endpoint
        location /health {
            proxy_pass http://localhost:$APP_PORT/health;
            access_log off;
        }
    }
}
NGINX_CONF_EOF

print_success "✅ Created new nginx.conf with AWS domain configuration"

# Remove default sites
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-available/default

# Test nginx configuration
if ! sudo nginx -t; then
    print_error "❌ Nginx configuration test failed!"
    exit 1
fi

sudo systemctl reload nginx
print_success "✅ Initial nginx configuration completed"

# Get SSL certificate with certbot
print_step "7/7 - Obtaining SSL certificate..."
print_status "🔐 Requesting SSL certificate from Let's Encrypt..."
print_status "📧 Email: $EMAIL"
print_status "🌐 Domain: $AWS_DOMAIN"

# Run certbot to get certificate
if sudo certbot --nginx \
    -d "$AWS_DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --redirect \
    --hsts \
    --staple-ocsp; then
    
    print_success "🎉 SSL certificate obtained successfully!"
else
    print_error "❌ Failed to obtain SSL certificate"
    print_error "Check the logs above for details"
    exit 1
fi

# Enhanced SSL configuration - Update nginx.conf with HTTPS
print_status "Creating enhanced SSL nginx configuration..."
sudo tee /etc/nginx/nginx.conf > /dev/null <<NGINX_CONF_EOF
# Global nginx configuration for Ubuntu EC2 with SSL
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
    # multi_accept on;
}

http {
    ##
    # Basic Settings
    ##
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Fix for long domain names (AWS EC2 domains)
    server_names_hash_bucket_size 128;
    
    # server_tokens off;
    # server_name_in_redirect off;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ##
    # SSL Settings
    ##
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    ##
    # Logging Settings
    ##
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    ##
    # Gzip Settings
    ##
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    ##
    # HTTP to HTTPS redirect
    ##
    server {
        listen 80;
        server_name $AWS_DOMAIN;
        
        # ACME challenge for certificate renewal
        location /.well-known/acme-challenge/ {
            root /var/www/html;
            try_files \$uri =404;
        }
        
        # Redirect all other requests to HTTPS
        location / {
            return 301 https://\$server_name\$request_uri;
        }
    }

    ##
    # HTTPS server with enhanced security
    ##
    server {
        listen 443 ssl http2;
        server_name $AWS_DOMAIN;

        # SSL Configuration managed by certbot
        ssl_certificate /etc/letsencrypt/live/$AWS_DOMAIN/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/$AWS_DOMAIN/privkey.pem;
        include /etc/letsencrypt/options-ssl-nginx.conf;
        ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
        
        # Enhanced security headers
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Performance and upload settings
        client_max_body_size 50M;
        client_body_timeout 60s;
        client_header_timeout 60s;

        # Main application proxy
        location / {
            proxy_pass http://localhost:$APP_PORT;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_set_header X-Forwarded-Host \$server_name;
            proxy_cache_bypass \$http_upgrade;
            
            # Enhanced timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 120s;
            proxy_read_timeout 120s;
            proxy_buffering off;
        }

        # Socket.IO WebSocket support
        location /socket.io/ {
            proxy_pass http://localhost:$APP_PORT;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            # WebSocket specific settings
            proxy_buffering off;
            proxy_cache_bypass \$http_upgrade;
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;
        }

        # API routes
        location /api/ {
            proxy_pass http://localhost:$APP_PORT;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            proxy_connect_timeout 60s;
            proxy_send_timeout 120s;
            proxy_read_timeout 120s;
        }

        # Static files with caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            proxy_pass http://localhost:$APP_PORT;
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary "Accept-Encoding";
        }

        # Health check (no logging)
        location /health {
            proxy_pass http://localhost:$APP_PORT/health;
            access_log off;
            proxy_connect_timeout 5s;
            proxy_send_timeout 5s;
            proxy_read_timeout 5s;
        }

        # API documentation
        location /api/docs {
            proxy_pass http://localhost:$APP_PORT/api/docs;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
NGINX_CONF_EOF

# Test and reload the enhanced configuration
if ! sudo nginx -t; then
    print_error "❌ Enhanced nginx configuration failed!"
    exit 1
fi

sudo systemctl reload nginx
print_success "✅ Enhanced SSL configuration applied"

# Configure firewall
print_status "Configuring firewall..."
sudo ufw --force enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Test certificate renewal
print_status "Testing automatic certificate renewal..."
if sudo certbot renew --dry-run; then
    print_success "✅ Certificate auto-renewal test successful"
else
    print_warning "⚠️  Certificate auto-renewal test failed, but certificate is valid"
fi

# Enable auto-start services
sudo systemctl enable nginx

# Final status checks
print_status "Running final verification..."

# Check nginx status
nginx_status=$(sudo systemctl is-active nginx)
print_status "Nginx status: $nginx_status"

# Check app connectivity
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT/health | grep -q "200"; then
    print_success "✅ App is responding on port $APP_PORT"
else
    print_warning "⚠️  App may not be responding on port $APP_PORT"
fi

# Show certificate details
print_status "SSL Certificate information:"
sudo certbot certificates

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "🎉 HTTPS setup completed successfully!"
echo ""
echo "🌟 Your Matcha application is now secured with SSL!"
echo ""
echo "📱 Access your application:"
echo "   🔒 HTTPS: https://$AWS_DOMAIN"
echo "   📚 API Docs: https://$AWS_DOMAIN/api/docs"
echo "   💓 Health: https://$AWS_DOMAIN/health"
echo ""
echo "🔧 Certificate Information:"
echo "   📧 Email: $EMAIL"
echo "   🌐 Domain: $AWS_DOMAIN"
echo "   🗓️  Valid: 90 days (auto-renewal enabled)"
echo ""
echo "🛠️  Useful Commands:"
echo "   sudo nginx -t                     # Test nginx config"
echo "   sudo systemctl reload nginx      # Reload nginx"
echo "   sudo certbot certificates        # View certificates"
echo "   sudo certbot renew --dry-run     # Test renewal"
echo "   sudo tail -f /var/log/nginx/error.log  # View nginx logs"
echo ""
echo "🚀 Test your setup:"
echo "   curl -I https://$AWS_DOMAIN"
echo "   curl https://$AWS_DOMAIN/health"
echo ""
echo "🔗 Next: When your custom domain DNS is ready, you can run:"
echo "   ./setup-ssl-matchat.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" 