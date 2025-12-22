# Admin Mode Guide

## Overview

The F1 Pro platform includes a secure admin mode that allows authorized users to:
- Load data for any Grand Prix weekend
- Execute SQL queries directly on the database
- Access all admin features while keeping the public site read-only

## How It Works

### 1. **Public Mode (Default)**
- Users can browse existing data
- All database queries use read-only connections
- No data modification allowed
- Data loading buttons are hidden

### 2. **Admin Mode**
- Accessed via password authentication
- Shows data loading buttons for weekends
- Enables SQL query console
- Uses write-enabled database connections

## Accessing Admin Mode

1. Click the **lock icon** 🔒 in the top-right corner
2. Enter the admin password
3. Click "Login"

Once authenticated:
- A green "Admin Mode" indicator appears
- Load Data buttons become visible
- SQL Query button appears in bottom-right

## Admin Features

### Data Loading
- Navigate to any Grand Prix weekend
- Click "Load More" to download missing sessions
- Monitor progress with real-time progress bars

### SQL Query Console
- Click "SQL Query" button (bottom-right)
- Write and execute SELECT queries
- View results in a formatted table
- Use example queries as templates

### Security Features
- Session-based authentication (24-hour expiry)
- Secure HTTP-only cookies
- Read-only database access for public endpoints
- SQL injection protection (SELECT queries only)