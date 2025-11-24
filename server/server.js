const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'tracking.db');

// Ensure data directory exists
const ensureDataDir = async () => {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
};

// Initialize SQLite database
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(err);
                return;
            }
            console.log('Connected to SQLite database');
        });

        // Create tables
        db.serialize(() => {
            // Sessions table
            db.run(`CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                user_ip TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Events table
            db.run(`CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_data TEXT,
                url TEXT,
                timestamp BIGINT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )`);
        });

        resolve(db);
    });
};

// Middleware
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration - Enhanced for sendBeacon support
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400 // 24 hours
}));

// Additional CORS headers for sendBeacon compatibility
app.use((req, res, next) => {
    // Allow all origins in development (already handled by cors middleware above)
    // But ensure these headers are always present for beacon requests
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Access-Control-Max-Age', '86400');
        return res.sendStatus(204);
    }
    next();
});

// Rate limiting
const trackingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many tracking requests from this IP'
});

const downloadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 downloads per windowMs
    message: 'Too many download requests from this IP'
});

// Database connection
let db;

// Helper functions
const getClientIP = (req) => {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Get or create session
app.post('/api/session', trackingLimiter, async (req, res) => {
    try {
        const { sessionId, experimentId = 'default' } = req.body;
        const userIP = getClientIP(req);
        const userAgent = req.headers['user-agent'];

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        // Check if session exists
        db.get(
            'SELECT * FROM sessions WHERE session_id = ?',
            [sessionId],
            (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (row) {
                    // Update last activity
                    db.run(
                        'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = ?',
                        [sessionId]
                    );
                    res.json({ sessionId, exists: true });
                } else {
                    // Create new session
                    db.run(
                        'INSERT INTO sessions (session_id, user_ip, user_agent) VALUES (?, ?, ?)',
                        [sessionId, userIP, userAgent],
                        function(err) {
                            if (err) {
                                console.error('Database error:', err);
                                return res.status(500).json({ error: 'Database error' });
                            }
                            res.json({ sessionId, exists: false, created: true });
                        }
                    );
                }
            }
        );
    } catch (error) {
        console.error('Session error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Track events
app.post('/api/track', trackingLimiter, async (req, res) => {
    try {
        const { sessionId, events } = req.body;

        if (!sessionId || !events || !Array.isArray(events)) {
            return res.status(400).json({ error: 'Session ID and events array are required' });
        }

        if (events.length === 0) {
            return res.json({ success: true, inserted: 0, total: 0, errors: [] });
        }

        // Verify session exists
        const sessionExists = await new Promise((resolve, reject) => {
            db.get('SELECT session_id FROM sessions WHERE session_id = ?', [sessionId], (err, row) => {
                if (err) reject(err);
                else resolve(!!row);
            });
        });

        if (!sessionExists) {
            return res.status(404).json({ error: 'Session not found. Please initialize session first.' });
        }

        // Prepare batch insert with Promise-based approach
        const insertPromises = [];
        const errors = [];

        for (const event of events) {
            const promise = new Promise((resolve, reject) => {
                try {
                    if (!event.type) {
                        errors.push({ event: 'unknown', error: 'Event type is required' });
                        resolve(false);
                        return;
                    }

                    const eventData = JSON.stringify({
                        ...event,
                        sessionId: undefined // Remove sessionId from event data to avoid duplication
                    });

                    db.run(
                        `INSERT INTO events (session_id, event_type, event_data, url, timestamp)
                         VALUES (?, ?, ?, ?, ?)`,
                        [sessionId, event.type, eventData, event.url || '', event.timestamp || Date.now()],
                        function(err) {
                            if (err) {
                                errors.push({ event: event.type, error: err.message });
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        }
                    );
                } catch (error) {
                    errors.push({ event: event.type, error: error.message });
                    resolve(false);
                }
            });
            insertPromises.push(promise);
        }

        // Wait for all inserts to complete
        const results = await Promise.all(insertPromises);
        const insertedCount = results.filter(r => r === true).length;

        // Update session last activity
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = ?',
                [sessionId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ 
            success: true, 
            inserted: insertedCount,
            total: events.length,
            errors: errors
        });

    } catch (error) {
        console.error('Tracking error:', error);
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

// Get experiment statistics
app.get('/api/stats/:experimentId?', (req, res) => {
    const experimentId = req.params.experimentId || 'default';
    
    const queries = {
        totalSessions: `SELECT COUNT(DISTINCT session_id) as count FROM sessions`,
        totalEvents: `SELECT COUNT(*) as count FROM events`,
        eventTypes: `SELECT event_type, COUNT(*) as count FROM events GROUP BY event_type`,
        recentSessions: `SELECT COUNT(DISTINCT session_id) as count FROM sessions WHERE created_at > datetime('now', '-24 hours')`
    };

    const results = {};
    let completedQueries = 0;
    const totalQueries = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
        if (key === 'eventTypes') {
            db.all(query, (err, rows) => {
                if (err) {
                    console.error(`Error in ${key} query:`, err);
                    results[key] = [];
                } else {
                    results[key] = rows;
                }
                completedQueries++;
                if (completedQueries === totalQueries) {
                    res.json(results);
                }
            });
        } else {
            db.get(query, (err, row) => {
                if (err) {
                    console.error(`Error in ${key} query:`, err);
                    results[key] = 0;
                } else {
                    results[key] = row.count;
                }
                completedQueries++;
                if (completedQueries === totalQueries) {
                    res.json(results);
                }
            });
        }
    });
});

// Export data as CSV
app.get('/api/export/:format?', downloadLimiter, async (req, res) => {
    try {
        const format = req.params.format || 'csv';
        const { sessionId, experimentId, startDate, endDate } = req.query;

        let query = `
            SELECT 
                s.session_id,
                s.user_ip,
                s.user_agent,
                s.created_at as session_created,
                e.event_type,
                e.event_data,
                e.url,
                e.timestamp,
                e.created_at as event_created
            FROM events e
            JOIN sessions s ON e.session_id = s.session_id
            WHERE 1=1
        `;
        
        const params = [];

        if (sessionId) {
            query += ' AND s.session_id = ?';
            params.push(sessionId);
        }

        if (startDate) {
            query += ' AND e.created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND e.created_at <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY e.timestamp ASC';

        // Add reasonable limit to prevent memory issues
        const MAX_EXPORT_ROWS = 100000;
        query += ` LIMIT ${MAX_EXPORT_ROWS}`;

        db.all(query, params, async (err, rows) => {
            if (err) {
                console.error('Export query error:', err);
                return res.status(500).json({ error: 'Database error', message: err.message });
            }

            if (rows.length === 0) {
                return res.status(404).json({ error: 'No data found for the specified criteria' });
            }

            if (format === 'json') {
                res.json({ count: rows.length, data: rows });
                return;
            }

            // CSV export
            const filename = `activity-data-${new Date().toISOString().split('T')[0]}.csv`;
            const csvPath = path.join(__dirname, 'data', filename);

            // Flatten the data for CSV
            const flattenedData = rows.map(row => {
                const eventData = JSON.parse(row.event_data || '{}');
                return {
                    session_id: row.session_id,
                    user_ip: row.user_ip,
                    user_agent: row.user_agent,
                    session_created: row.session_created,
                    event_type: row.event_type,
                    url: row.url,
                    timestamp: row.timestamp,
                    event_created: row.event_created,
                    ...eventData
                };
            });

            // Get all possible columns
            const allColumns = new Set();
            flattenedData.forEach(row => {
                Object.keys(row).forEach(key => {
                    if (typeof row[key] !== 'object' || row[key] === null) {
                        allColumns.add(key);
                    } else {
                        // Flatten nested objects
                        Object.keys(row[key]).forEach(nestedKey => {
                            allColumns.add(`${key}.${nestedKey}`);
                        });
                    }
                });
            });

            const csvWriter = createCsvWriter({
                path: csvPath,
                header: Array.from(allColumns).map(col => ({ id: col, title: col }))
            });

            // Flatten nested objects in data
            const csvData = flattenedData.map(row => {
                const flatRow = {};
                allColumns.forEach(col => {
                    if (col.includes('.')) {
                        const [parent, child] = col.split('.');
                        flatRow[col] = row[parent] && row[parent][child] ? row[parent][child] : '';
                    } else {
                        flatRow[col] = row[col] || '';
                    }
                });
                return flatRow;
            });

            try {
                await csvWriter.writeRecords(csvData);
            } catch (writeError) {
                console.error('CSV write error:', writeError);
                await fs.unlink(csvPath).catch(console.error);
                return res.status(500).json({ error: 'Failed to generate CSV file', message: writeError.message });
            }

            res.download(csvPath, filename, async (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
                // Clean up file after download
                try {
                    await fs.unlink(csvPath);
                } catch (unlinkError) {
                    console.error('Failed to cleanup CSV file:', unlinkError);
                }
            });
        });

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin dashboard (simple HTML interface)
app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Activity Tracker Admin</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007cba; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        button:hover { background: #005a87; }
        .export-section { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        #statsContent { margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Activity Tracker Admin Dashboard</h1>
        
        <div id="statsContent">
            <p>Loading statistics...</p>
        </div>
        
        <div class="export-section">
            <h3>Export Data</h3>
            <p>Download collected activity data:</p>
            <button id="exportCsvBtn">Download CSV</button>
            <button id="exportJsonBtn">Download JSON</button>
            <button id="refreshStatsBtn">Refresh Stats</button>
        </div>
        
        <div class="export-section">
            <h3>Filtered Export</h3>
            <label>Start Date: <input type="date" id="startDate"></label><br><br>
            <label>End Date: <input type="date" id="endDate"></label><br><br>
            <label>Session ID: <input type="text" id="sessionId" placeholder="Optional"></label><br><br>
            <button id="exportFilteredBtn">Export Filtered Data</button>
        </div>
    </div>

    <script>
        // Event handlers
        function exportData(format) {
            window.open('/api/export/' + format);
        }
        
        function exportFiltered() {
            const params = new URLSearchParams();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const sessionId = document.getElementById('sessionId').value;
            
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (sessionId) params.append('sessionId', sessionId);
            
            window.open('/api/export/csv?' + params.toString());
        }
        
        async function viewStats() {
            try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                
                document.getElementById('statsContent').innerHTML = \`
                    <div class="stats">
                        <div class="stat-card">
                            <div class="stat-number">\${stats.totalSessions}</div>
                            <div>Total Sessions</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">\${stats.totalEvents}</div>
                            <div>Total Events</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">\${stats.recentSessions}</div>
                            <div>Sessions (24h)</div>
                        </div>
                    </div>
                    <h4>Event Types:</h4>
                    <ul>
                        \${stats.eventTypes.map(type => \`<li>\${type.event_type}: \${type.count} events</li>\`).join('')}
                    </ul>
                \`;
            } catch (error) {
                console.error('Error loading stats:', error);
                document.getElementById('statsContent').innerHTML = '<p>Error loading statistics</p>';
            }
        }
        
        // Set up event listeners when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            // Button event listeners
            document.getElementById('exportCsvBtn').addEventListener('click', () => exportData('csv'));
            document.getElementById('exportJsonBtn').addEventListener('click', () => exportData('json'));
            document.getElementById('refreshStatsBtn').addEventListener('click', viewStats);
            document.getElementById('exportFilteredBtn').addEventListener('click', exportFiltered);
            
            // Load stats on page load
            viewStats();
            
            // Auto-refresh every 30 seconds
            setInterval(viewStats, 30000);
        });
    </script>
</body>
</html>
    `);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Initialize and start server
const startServer = async () => {
    try {
        await ensureDataDir();
        db = await initDatabase();
        
        app.listen(PORT, () => {
            console.log(`Activity Tracker Server running on port ${PORT}`);
            console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
            console.log(`Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed.');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

startServer();