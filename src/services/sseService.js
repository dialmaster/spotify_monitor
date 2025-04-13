/**
 * Server-Sent Events (SSE) Service
 * Manages connected clients and broadcasts updates
 */

class SSEService {
    constructor() {
        this.clients = new Map(); // Map of client ID to client information
        this.cleanupInterval = null;
        this.inactivityTimeoutMs = 120000; // 2 minutes timeout for inactive connections
        this.startCleanupInterval();
    }

    /**
     * Add a new client connection
     * @param {string} clientId - Unique client identifier
     * @param {object} res - Express response object
     * @returns {void}
     */
    addClient(clientId, res) {
        // Set headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Send initial connection established message
        res.write(`data: ${JSON.stringify({ event: 'connected', clientId })}\n\n`);

        // Store client with initial last update time and activity time
        this.clients.set(clientId, {
            response: res,
            lastTimeUpdated: null,
            lastActivityTime: Date.now()
        });

        console.log(`SSE: Client ${clientId} connected. Total clients: ${this.clients.size}`);

        // Handle client disconnect
        res.on('close', () => this.removeClient(clientId));
    }

    /**
     * Remove a client connection
     * @param {string} clientId - Unique client identifier
     * @returns {void}
     */
    removeClient(clientId) {
        if (this.clients.has(clientId)) {
            this.clients.delete(clientId);
            console.log(`SSE: Client ${clientId} disconnected. Total clients: ${this.clients.size}`);
        }
    }

    /**
     * Send an update to a specific client if data has changed
     * @param {string} clientId - Unique client identifier
     * @param {object} data - Data to send to client
     * @param {number} timeLastUpdated - Timestamp of last update
     * @returns {boolean} - Whether data was sent
     */
    sendUpdate(clientId, data, timeLastUpdated) {
        if (!this.clients.has(clientId)) {
            return false;
        }

        const client = this.clients.get(clientId);

        // Only send update if the timeLastUpdated has changed
        if (client.lastTimeUpdated !== timeLastUpdated) {
            try {
                client.response.write(`data: ${JSON.stringify(data)}\n\n`);
                client.lastTimeUpdated = timeLastUpdated;
                client.lastActivityTime = Date.now(); // Update activity time
                return true;
            } catch (error) {
                console.error(`SSE: Error sending to client ${clientId}`, error);
                this.removeClient(clientId);
                return false;
            }
        }

        return false;
    }

    /**
     * Broadcast data to all connected clients if their last update time differs
     * @param {object} data - Data to broadcast
     * @param {number} timeLastUpdated - Timestamp of last update
     * @returns {number} - Number of clients that received the update
     */
    broadcast(data, timeLastUpdated) {
        let updateCount = 0;

        this.clients.forEach((client, clientId) => {
            if (this.sendUpdate(clientId, data, timeLastUpdated)) {
                updateCount++;
            }
        });

        if (updateCount > 0) {
            console.log(`SSE: Broadcast to ${updateCount} clients`);
        }

        return updateCount;
    }

    /**
     * Get connected client count
     * @returns {number} - Number of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }

    /**
     * Start periodic cleanup of inactive connections
     * @returns {void}
     */
    startCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveConnections();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Clean up connections that have been inactive for too long
     * @returns {number} - Number of clients removed
     */
    cleanupInactiveConnections() {
        const now = Date.now();
        let removedCount = 0;

        this.clients.forEach((client, clientId) => {
            const inactiveDuration = now - client.lastActivityTime;

            if (inactiveDuration > this.inactivityTimeoutMs) {
                try {
                    // Send a ping to verify connection is still alive
                    client.response.write(`:ping\n\n`);

                    // If write fails, removeClient will be called in the catch block
                    // If write succeeds, update lastActivityTime
                    client.lastActivityTime = now;
                } catch (error) {
                    console.log(`SSE: Removing inactive client ${clientId} (${inactiveDuration}ms inactive)`);
                    this.removeClient(clientId);
                    removedCount++;
                }
            }
        });

        if (removedCount > 0) {
            console.log(`SSE: Cleaned up ${removedCount} inactive connections`);
        }

        return removedCount;
    }

    /**
     * Stop the cleanup interval when service is shutting down
     * @returns {void}
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// Singleton instance
const sseService = new SSEService();

module.exports = sseService;