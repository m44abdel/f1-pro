#!/bin/bash

echo "F1 Pro Environment Setup"
echo "========================"
echo ""
echo "This script will help you set up your environment variables."
echo ""

# Check if .env.local exists
if [ -f "apps/web/.env.local" ]; then
    echo "✓ .env.local file already exists"
    
    # Check if DATABASE_URL is set
    if grep -q "DATABASE_URL=" apps/web/.env.local; then
        echo "  DATABASE_URL is already configured"
    else
        echo ""
        echo "  DATABASE_URL is not configured in .env.local"
        echo ""
        echo "Please add your Neon database URL to apps/web/.env.local:"
        echo ""
        echo "DATABASE_URL=postgresql://username:password@host/database?sslmode=require"
        echo ""
        echo "You can get this from your Neon dashboard."
    fi
else
    echo "Creating .env.local file..."
    cat > apps/web/.env.local << 'EOF'
# Database connection
DATABASE_URL=postgresql://your-neon-connection-string-here

# Admin configuration (DO NOT COMMIT)
ADMIN_PASSWORD=F1ProAdmin$
ADMIN_API_TOKEN=your-secure-token-here

# Optional: Read-only database URL for public queries
# DATABASE_URL_READONLY=postgresql://readonly-user@host/database?sslmode=require
EOF
    
    echo "  Created apps/web/.env.local"
    echo ""
    echo "   IMPORTANT: You must update DATABASE_URL in apps/web/.env.local"
    echo ""
    echo "1. Go to your Neon dashboard"
    echo "2. Copy your connection string"
    echo "3. Replace 'your-neon-connection-string-here' in apps/web/.env.local"
fi

echo ""
echo "Next steps:"
echo "1. Make sure DATABASE_URL is properly set in apps/web/.env.local"
echo "2. Restart your Next.js dev server"
echo "3. Try downloading data again"
