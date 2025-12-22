# Deployment Guide

This guide contains basic deployment instructions for the F1 Pro platform.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon recommended)
- Python 3.10+ (for data ingestion)

### Deployment Options

1. **Vercel** (Recommended for Next.js apps)
   - Connect your GitHub repository
   - Configure environment variables
   - Deploy

2. **Self-Hosted**
   - Build the application
   - Set up a Node.js server
   - Configure reverse proxy (nginx/Apache)

3. **Platform-as-a-Service**
   - Railway
   - Render
   - Fly.io
   - DigitalOcean App Platform

### Environment Variables

Required environment variables are documented in the codebase.
For security reasons, specific configuration details are not included in public documentation.

### Database Setup

1. Create a PostgreSQL database
2. Apply the schema from `infra/db/001_init.sql`
3. Configure database connections

## Support

For deployment assistance or questions, please contact the project maintainer.