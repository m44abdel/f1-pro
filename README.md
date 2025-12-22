# F1 Pro Analytics Platform

A comprehensive Formula 1 analytics platform for exploring race data, telemetry, and performance insights.

## Features

### Core Experience
- **Session Browser**: Navigate through seasons, Grand Prix weekends, and individual sessions
- **Driver Comparison**: Compare telemetry data between multiple drivers
- **Telemetry Traces**: Visualize speed, throttle, brake, and gear data
- **Track Map**: Interactive circuit visualization with telemetry overlay
- **Stint/Tire View**: Analyze tire strategies and pit stop timing
- **Timing Tower**: Live-style timing and gap visualization
- **Position Changes**: Track position changes throughout the race
- **Lap Time Analysis**: Compare lap times across drivers with stint context

## Setup

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- PostgreSQL (or Neon database)

### Environment Variables
Create a `.env.local` file in `apps/web/` with:
```
DATABASE_URL=your_postgresql_connection_string
```

### Installation

1. Install Python dependencies:
```bash
python -m venv f1_venv
source f1_venv/bin/activate 
pip install -r python/requirements.txt
```

2. Install Node.js dependencies:
```bash
cd apps/web
npm install
```

3. Apply database schema:
```bash
cd python
python run_schema.py
```

### Running the Application

```bash
cd apps/web
npm run dev
```

Visit http://localhost:3000 to access the application.

## Data Loading

The platform supports on-demand data loading for specific Grand Prix weekends:
- Click "Load All Data" to download all session data for a weekend
- Use the dropdown to load individual sessions (Qualifying, Race, Sprint, Sprint Shootout)
- Progress bars show download status for each session

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Visualization**: Recharts, @visx
- **Backend**: Next.js API routes, PostgreSQL
- **Data Pipeline**: Python with fastf1 library
- **Database**: Neon PostgreSQL

## Project Structure

```
f1-pro/
├── apps/web/          # Next.js web application
├── python/            # Data ingestion scripts
├── infra/db/         # Database schema
└── f1_venv/          # Python virtual environment
```

## Deployment

### Security Considerations

For production deployment:
1. Create a read-only database user (see `infra/db/002_readonly_user.sql`)
2. Use separate environment variables for read/write database access
3. Protect data ingestion endpoints with authentication
4. Hide admin features from public users

### Quick Deploy to Vercel

1. Fork/clone this repository
2. Connect to Vercel
3. Set environment variables:
   - `DATABASE_URL_READONLY` - Read-only database connection
   - `DATABASE_URL` - Admin database connection (keep secure)
   - `ADMIN_API_TOKEN` - Secret token for admin operations
4. Deploy

See `DEPLOYMENT.md` for detailed deployment and security instructions.
