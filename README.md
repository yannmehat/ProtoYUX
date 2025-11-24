# ActivityTracker

A centralized user activity tracking system for research experiments and user behavior analysis. Perfect for thesis projects where you need to collect data from multiple participants automatically.

## 🚀 Quick Start

### Step 1: Start the Server
```bash
cd server
npm install && npm start
```
Server runs at `http://localhost:3000` with admin dashboard at `/admin`.

### Step 2: Add to Your Website
```html
<script src="activity-tracker-server.js"></script>
<script>
const tracker = new ActivityTrackerServer({
    serverUrl: 'http://localhost:3000',
    experimentId: 'my-thesis-study'
});
</script>
```

### Step 3: Collect Data
- Participants interact with your website normally
- All data automatically sent to central server
- Visit `http://localhost:3000/admin` to download CSV exports

## Features

- 📊 **Page Tracking**: Track page loads, time spent, and navigation
- 🖱️ **Click Tracking**: Capture click coordinates and target elements  
- ⌨️ **Input Tracking**: Monitor form interactions and user input
- 🌐 **IP Identification**: Automatically detect user IP addresses
- �️ **Centralized Storage**: SQLite database with all participant data
- 📈 **Admin Dashboard**: Real-time stats and CSV export
- 🔄 **Offline Support**: Queues data when connection is lost
- 🔧 **Easy Integration**: Add 3 lines of code to any website
- 🎯 **Minimal Dependencies**: Pure JavaScript frontend, lightweight Node.js backend

## What Gets Tracked

### Automatic Tracking
- **Page Activity**: Load times, time spent, navigation between pages
- **Click Events**: Coordinates, target elements, timestamps
- **Form Interactions**: Input values, focus/blur events, form submissions
- **User Context**: IP address, browser info, screen size

### Data Format
All data is automatically sent to the server and stored in SQLite database. Export as CSV includes:
- `session_id` - Unique participant identifier
- `user_ip` - Participant's IP address  
- `event_type` - Type of interaction (click, input, page_load, etc.)
- `timestamp` - When the event occurred
- `url` - Page where event happened
- Plus detailed event-specific data (coordinates, values, etc.)

## Server Configuration

### Basic Setup
```javascript
const tracker = new ActivityTrackerServer({
    serverUrl: 'http://localhost:3000',     // Your server URL
    experimentId: 'my-study',               // Unique study identifier
    trackClicks: true,                      // Enable click tracking
    trackInputs: true,                      // Enable input tracking  
    trackPageViews: true                    // Enable page tracking
});
```

### Advanced Options
```javascript
const tracker = new ActivityTrackerServer({
    serverUrl: 'http://your-server.com:3000',
    experimentId: 'advanced-study-2023',
    batchSize: 20,                          // Send 20 events at once
    sendInterval: 10000,                    // Send every 10 seconds
    offlineStorage: true,                   // Store data when offline
    maxRetries: 5                          // Retry failed requests
});
```

## Server API

### For Researchers (Admin Dashboard)
- `GET /admin` - Admin dashboard interface
- `GET /api/export/csv` - Download all data as CSV
- `GET /api/export/json` - Download all data as JSON  
- `GET /api/stats` - View experiment statistics

### Filtered Exports
Add query parameters to export specific data:
```
/api/export/csv?sessionId=session_123
/api/export/csv?startDate=2023-01-01&endDate=2023-01-31
/api/export/csv?experimentId=study-001
```

### For Frontend Library (Automatic)
- `POST /api/session` - Initialize participant session
- `POST /api/track` - Send tracking events (batched)

## Installation & Deployment

### Local Development
```bash
# Clone or download the repository
cd ActivityTracker/server
npm install
npm start

# Server runs at http://localhost:3000
# Admin dashboard at http://localhost:3000/admin
```

### Production Deployment
For university servers or cloud deployment, see [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

### Environment Configuration
Create `.env` file in server directory:
```bash
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com,https://yourseconddomain.com
```

## Usage Examples

### Simple Research Page
```html
<!DOCTYPE html>
<html>
<head>
    <title>My Research Study</title>
</head>
<body>
    <h1>Welcome to the Study</h1>
    
    <form id="survey">
        <input type="text" placeholder="Your age">
        <button type="submit">Submit</button>
    </form>
    
    <!-- Activity Tracker -->
    <script src="activity-tracker-server.js"></script>
    <script>
        const tracker = new ActivityTrackerServer({
            serverUrl: 'http://localhost:3000',
            experimentId: 'user-experience-study'
        });
    </script>
</body>
</html>
```

### Auto-Initialize with Script Attributes
```html
<script 
    src="activity-tracker-server.js" 
    data-server-url="http://localhost:3000"
    data-experiment-id="my-study">
</script>
```

## Data Analysis

### CSV Structure
The exported CSV contains these key columns:
- `session_id`, `user_ip`, `timestamp`, `event_type`, `url`
- `x`, `y` coordinates for clicks
- `value`, `valueLength` for input fields
- `target.*` columns with element details
- Plus custom event data

### Sample Analysis (Python)
```python
import pandas as pd

# Load exported data
df = pd.read_csv('activity-data.csv')

# Basic statistics
print(f"Participants: {df['session_id'].nunique()}")
print(f"Total interactions: {len(df)}")

# Analyze clicks
clicks = df[df['event_type'] == 'click']
print(f"Average clicks per user: {len(clicks) / df['session_id'].nunique():.1f}")

# Time analysis
df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
session_duration = df.groupby('session_id')['timestamp'].agg(['min', 'max'])
session_duration['duration'] = session_duration['max'] - session_duration['min']
print(f"Average session: {session_duration['duration'].mean()}")
```

## File Structure

```
ActivityTracker/
├── server/                          # Backend Node.js server
│   ├── server.js                   # Main server code
│   ├── package.json                # Dependencies
│   └── data/                       # SQLite database (auto-created)
├── activity-tracker-server.js      # Frontend tracking library
├── demo-server.html                # Interactive demonstration
├── research-example.html           # Research study template
├── README.md                       # This documentation
└── DEPLOYMENT.md                   # Deployment guide
```

## Privacy & Ethics

This library is designed for academic research. When using:

1. **Inform participants** about data collection in your consent form
2. **Obtain proper consent** for tracking interactions  
3. **Follow institutional ethics** guidelines and data protection laws
4. **Secure your server** and collected data appropriately
5. **Consider data anonymization** for sensitive studies

## Troubleshooting

### Server Issues
- **Can't connect**: Check if server is running with `curl http://localhost:3000/health`
- **CORS errors**: Add your domain to `ALLOWED_ORIGINS` in `.env` file
- **Database errors**: Check write permissions in `server/data/` directory

### Tracking Issues  
- **No data appearing**: Check browser console for JavaScript errors
- **Events not sending**: Verify server URL in tracker configuration
- **Offline data lost**: Ensure `offlineStorage: true` in tracker options

## Support

For deployment help, see [DEPLOYMENT.md](DEPLOYMENT.md).
For a working example, open `demo-server.html` or `research-example.html`.

This tool was created for academic research and thesis projects. 📊