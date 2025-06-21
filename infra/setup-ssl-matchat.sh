#!/bin/bash

# SSL Setup for matchat-app.xyz with Certbot
# Run this script on your EC2 instance as ubuntu user

set -e

# Configuration
DOMAIN="matchat-app.xyz"
EMAIL="buixuanhinhxtnd@gmail.com"  # Pre-configured email
APP_PORT="3030"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_error "Please run this script as ubuntu user, not root!"
    exit 1
fi

print_status "🚀 Setting up SSL for $DOMAIN on port $APP_PORT"
print_status "📧 Using email: $EMAIL"

# Pre-flight checks
print_step "1/8 - Running pre-flight checks..."

# Check if app is running on port 3030
if ! curl -s http://localhost:$APP_PORT/health > /dev/null; then
    print_warning "Your app doesn't seem to be running on port $APP_PORT"
    print_warning "Make sure your Node.js app is running before continuing"
    read -p "Continue anyway? (y/n): " continue_setup
    if [[ $continue_setup != "y" ]]; then
        exit 1
    fi
fi

# Check DNS resolution
print_status "Checking DNS resolution for $DOMAIN..."
if ! nslookup $DOMAIN | grep -q "$(curl -s ifconfig.me)"; then
    print_warning "DNS may not be properly configured. Make sure $DOMAIN points to this server's IP"
    print_warning "Current server IP: $(curl -s ifconfig.me)"
    read -p "Continue anyway? (y/n): " continue_dns
    if [[ $continue_dns != "y" ]]; then
        exit 1
    fi
fi

# Update system
print_step "2/8 - Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Install prerequisites
print_step "3/8 - Installing prerequisites..."
sudo apt-get install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates

# Install nginx
print_step "4/8 - Installing and configuring nginx..."
sudo apt-get install -y nginx

# Enable and start nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Install certbot with enhanced error handling
print_step "5/8 - Installing certbot..."
sudo apt-get install -y snapd

# Ensure snapd is running
sudo systemctl enable snapd
sudo systemctl start snapd

# Wait for snap to be ready
sleep 5

# Install core snap and certbot
print_status "Installing snap core..."
sudo snap install core 2>/dev/null || true
sudo snap refresh core 2>/dev/null || true

print_status "Installing certbot..."
sudo snap install --classic certbot

# Create symlink for certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot

# Verify certbot installation
if ! command -v certbot &> /dev/null; then
    print_error "Certbot installation failed!"
    exit 1
fi

print_status "✅ Certbot installed successfully: $(certbot --version)"

# Create initial nginx config for HTTP and ACME challenge
print_step "6/8 - Creating initial nginx configuration..."
sudo tee /etc/nginx/sites-available/matchat-app > /dev/null <<NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
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
        
        # Handle connection errors gracefully
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX_EOF

# Enable the site and disable default
sudo ln -sf /etc/nginx/sites-available/matchat-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
if ! sudo nginx -t; then
    print_error "Nginx configuration test failed!"
    exit 1
fi

# Reload nginx
sudo systemctl reload nginx

print_status "✅ Initial nginx configuration completed"

# Generate SSL certificate with certbot
print_step "7/8 - Generating SSL certificate with Let's Encrypt..."
print_status "Using certbot to obtain SSL certificate for:"
print_status "  - $DOMAIN"
print_status "  - www.$DOMAIN"
print_status "  - Email: $EMAIL"

# Run certbot with detailed options
if sudo certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --redirect \
    --hsts \
    --staple-ocsp \
    --expand; then
    
    print_status "✅ SSL certificate obtained successfully!"
else
    print_error "Failed to obtain SSL certificate"
    print_error "Common issues:"
    print_error "  1. DNS not pointing to this server"
    print_error "  2. Port 80/443 not accessible from internet" 
    print_error "  3. Another service using port 80"
    exit 1
fi

# Create enhanced SSL-enabled nginx config
print_status "Creating enhanced SSL nginx configuration..."
sudo tee /etc/nginx/sites-available/matchat-app > /dev/null <<NGINX_EOF
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # ACME challenge location for certificate renewal
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files \$uri =404;
    }
    
    # Redirect all other HTTP requests to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server with enhanced security
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Configuration managed by certbot
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Enhanced security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # File upload and performance settings
    client_max_body_size 50M;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # Main application proxy with enhanced settings
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
        
        # Enhanced timeout settings for API calls
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        proxy_buffering off;
    }

    # Socket.IO support with enhanced configuration
    location /socket.io/ {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Socket.IO specific optimizations
        proxy_buffering off;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # API routes with caching headers
    location /api/ {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # API-specific settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Static files with aggressive caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        proxy_pass http://localhost:$APP_PORT;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
    }

    # Health check endpoint (no logging)
    location /health {
        proxy_pass http://localhost:$APP_PORT/health;
        access_log off;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }

    # Swagger documentation
    location /api/docs {
        proxy_pass http://localhost:$APP_PORT/api/docs;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_EOF

# Test and reload nginx with the new configuration
if ! sudo nginx -t; then
    print_error "Enhanced nginx configuration test failed! Reverting..."
    # Certbot should have created a working config, so this shouldn't happen
    exit 1
fi

sudo systemctl reload nginx
print_status "✅ Enhanced SSL nginx configuration applied"

# Configure firewall
print_step "8/8 - Configuring firewall and final setup..."
print_status "Configuring UFW firewall..."
sudo ufw --force enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Test certificate renewal
print_status "Testing automatic certificate renewal..."
if sudo certbot renew --dry-run; then
    print_status "✅ Certificate auto-renewal test successful"
else
    print_warning "Certificate auto-renewal test failed, but certificate is still valid"
fi

# Enable services to start on boot
sudo systemctl enable nginx
sudo systemctl enable snap.certbot.renew.timer

# Final status checks
print_status "Running final status checks..."

# Check nginx status
nginx_status=$(sudo systemctl is-active nginx)
print_status "Nginx status: $nginx_status"

# Check app connectivity
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT/health | grep -q "200"; then
    print_status "✅ App is responding on port $APP_PORT"
else
    print_warning "⚠️  App may not be responding on port $APP_PORT"
fi

# Check SSL certificate
print_status "SSL Certificate details:"
sudo certbot certificates

print_status "🎉 SSL setup completed successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌟 Your Matcha application is now secured with SSL!"
echo ""
echo "📱 Access your application:"
echo "   🔒 HTTPS: https://$DOMAIN"
echo "   🔒 HTTPS: https://www.$DOMAIN"
echo "   📚 API Docs: https://$DOMAIN/api/docs"
echo "   💓 Health Check: https://$DOMAIN/health"
echo ""
echo "🔧 Certificate Information:"
echo "   📧 Registered to: $EMAIL"
echo "   🗓️  Valid for: 90 days (auto-renewal enabled)"
echo "   🔄 Renewal timer: $(sudo systemctl is-enabled snap.certbot.renew.timer)"
echo ""
echo "🛠️  Useful Commands:"
echo "   nginx -t                  # Test nginx configuration"
echo "   systemctl reload nginx    # Reload nginx"
echo "   certbot certificates      # View certificate details"
echo "   certbot renew --dry-run   # Test certificate renewal"
echo "   tail -f /var/log/nginx/error.log  # View nginx errors"
echo ""
echo "🚀 Next Steps:"
echo "   1. Test your app: curl -I https://$DOMAIN"
echo "   2. Update your frontend URLs to use HTTPS"
echo "   3. Test SSL rating: https://www.ssllabs.com/ssltest/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" 