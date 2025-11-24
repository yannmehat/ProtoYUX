# Activity Tracker Server Setup Guide

## Quick Start (5-Minute Setup)

### 1. Start the Server

```bash
# Navigate to server directory
cd server

# Install dependencies (first time only)
npm install

# Start the server
npm start
```

The server will start on `http://localhost:3000`

### 2. Add Tracking to Your Website

Include this in your HTML page:

```html
<!-- Include the server-connected library -->
<script src="activity-tracker-server.js"></script>

<script>
// Initialize with your server URL
const tracker = new ActivityTrackerServer({
    serverUrl: 'http://localhost:3000',  // Change to your server URL
    experimentId: 'my-experiment'        // Unique ID for your study
});
</script>
```

### 3. View & Export Data

Visit the admin dashboard: `http://localhost:3000/admin`

## Complete Setup

### Server Installation

1. **Install Node.js** (version 16 or higher)
   - Download from https://nodejs.org/

2. **Setup the Server**
   ```bash
   cd server
   npm install
   ```

3. **Configure Environment** (optional)
   ```bash
   cp .env.example .env
   # Edit .env file with your settings
   ```

4. **Start the Server**
   ```bash
   npm start
   # Or for development with auto-restart:
   npm run dev
   ```

### Frontend Integration

#### Basic Integration
```html
<script src="activity-tracker-server.js"></script>
<script>
const tracker = new ActivityTrackerServer({
    serverUrl: 'http://your-server.com:3000',
    experimentId: 'experiment-001'
});
</script>
```

#### Auto-Initialization
```html
<script 
    src="activity-tracker-server.js" 
    data-server-url="http://localhost:3000"
    data-experiment-id="my-study">
</script>
```

#### Advanced Configuration
```javascript
const tracker = new ActivityTrackerServer({
    serverUrl: 'http://localhost:3000',
    experimentId: 'advanced-study',
    trackClicks: true,
    trackInputs: true,
    trackPageViews: true,
    batchSize: 20,           // Send 20 events at a time
    sendInterval: 10000,     // Send every 10 seconds
    offlineStorage: true,    // Store data when offline
    maxRetries: 5           // Retry failed requests
});
```

## Server API Endpoints

### For Frontend Library
- `POST /api/session` - Initialize user session
- `POST /api/track` - Send tracking events
- `GET /api/stats` - Get experiment statistics

### For Researchers
- `GET /admin` - Admin dashboard
- `GET /api/export/csv` - Download all data as CSV
- `GET /api/export/json` - Download all data as JSON

### Filtered Exports
```
GET /api/export/csv?sessionId=session_123
GET /api/export/csv?startDate=2023-01-01&endDate=2023-01-31
GET /api/export/csv?experimentId=study-001
```

## Deployment Options

### Option 1: Local Development/Small Studies
```bash
# Run on your computer
cd server
npm start
# Access at http://localhost:3000
```

### Option 2: University/Institution Server
```bash
# On your server
git clone [your-repo]
cd ActivityTracker/server
npm install
npm start

# Configure firewall to allow port 3000
# Update frontend code with server IP/domain
```

### Option 3: Cloud Deployment (Heroku)
```bash
# Install Heroku CLI
heroku create your-activity-tracker
heroku config:set NODE_ENV=production
git subtree push --prefix server heroku main
```

### Option 4: Cloud Deployment (Railway/Render)
1. Connect your GitHub repository
2. Set root directory to `/server`
3. Set build command: `npm install`
4. Set start command: `npm start`

## Database Information

### SQLite Database
- Location: `server/data/tracking.db`
- Automatically created on first run
- Contains tables: `sessions`, `events`

### Database Schema

**Sessions Table:**
- session_id (unique identifier)
- user_ip (participant IP)
- user_agent (browser info)
- created_at, last_activity (timestamps)

**Events Table:**
- session_id (links to sessions)
- event_type (click, input, page_load, etc.)
- event_data (JSON with details)
- url, timestamp

## Security Considerations

### For Research Studies
1. **Inform Participants**: Add consent forms
2. **HTTPS**: Use SSL certificates for production
3. **CORS**: Configure allowed origins in .env
4. **Rate Limiting**: Built-in protection against spam
5. **Data Anonymization**: Consider removing IP addresses

### Environment Variables (.env)
```bash
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com,https://anotherdomain.com
RATE_LIMIT_TRACKING=100
RATE_LIMIT_DOWNLOADS=5
```

## Troubleshooting

### Common Issues

**"Cannot connect to server"**
- Check if server is running: `curl http://localhost:3000/health`
- Verify server URL in frontend code
- Check firewall settings

**"CORS Error"**
- Add your domain to ALLOWED_ORIGINS in .env
- Restart server after .env changes

**"Database Error"**
- Check file permissions in server/data/ directory
- Ensure SQLite3 is properly installed

**"Too Many Requests"**
- Adjust rate limits in .env
- Check for infinite loops in tracking code

### Debug Mode
```javascript
// Enable detailed logging
const tracker = new ActivityTrackerServer({
    serverUrl: 'http://localhost:3000',
    debug: true  // Add this for detailed console logs
});
```

### Server Logs
```bash
# View real-time server logs
cd server
npm run dev  # Shows detailed logs with nodemon
```

## Data Analysis

### CSV Export Structure
The exported CSV contains these columns:
- `session_id` - Unique participant identifier
- `user_ip` - Participant IP address
- `event_type` - Type of interaction (click, input, page_load, etc.)
- `timestamp` - When the event occurred
- `url` - Page where event happened
- Plus specific data for each event type (coordinates, values, etc.)

### Sample Analysis (Python/Pandas)
```python
import pandas as pd

# Load exported data
df = pd.read_csv('activity-data.csv')

# Basic statistics
print(f"Total participants: {df['session_id'].nunique()}")
print(f"Total interactions: {len(df)}")

# Clicks analysis
clicks = df[df['event_type'] == 'click']
print(f"Average clicks per user: {len(clicks) / df['session_id'].nunique()}")

# Time analysis
df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
session_times = df.groupby('session_id')['timestamp'].agg(['min', 'max'])
session_times['duration'] = session_times['max'] - session_times['min']
print(f"Average session duration: {session_times['duration'].mean()}")
```

## Support

### Files Structure
```
ActivityTracker/
├── server/                     # Backend server
│   ├── server.js              # Main server code
│   ├── package.json           # Dependencies
│   ├── .env.example          # Configuration template
│   └── data/                 # SQLite database (auto-created)
├── activity-tracker-server.js # Frontend library
├── demo-server.html          # Working example
└── DEPLOYMENT.md            # This file
```

### Getting Help
1. Check server logs for error messages
2. Test with the demo-server.html file first
3. Verify server is accessible from your website's domain
4. Check browser console for JavaScript errors

## Production Checklist

Before deploying for your thesis:

- [ ] Server is accessible from your study website
- [ ] HTTPS is configured (required for many universities)
- [ ] CORS is properly configured for your domain
- [ ] Backup system is in place for the database
- [ ] Participant consent includes data collection notice
- [ ] Rate limiting is appropriate for your study size
- [ ] You have tested the full workflow from participant view to data export