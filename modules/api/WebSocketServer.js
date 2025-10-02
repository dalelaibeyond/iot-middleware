const WebSocket = require("ws");
const BaseComponent = require("../core/BaseComponent");
const eventBus = require("../core/eventBus");

class WebSocketServer extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.clients = new Set();
  }

  async initialize() {
    try {
      this.validateOptions(["server"]);

      this.wss = new WebSocket.Server({ server: this.options.server });
      this.setupEventHandlers();

      // Subscribe to message events for broadcasting
      eventBus.on("message.processed", this.broadcast.bind(this));

      this.logger.info("WebSocket server initialized");
    } catch (error) {
      this.logger.error("Failed to initialize WebSocket server:", error);
      throw error;
    }
  }

  setupEventHandlers() {
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      this.logger.debug(
        `Client connected. Total clients: ${this.clients.size}`
      );

      ws.on("close", () => {
        this.clients.delete(ws);
        this.logger.debug(
          `Client disconnected. Total clients: ${this.clients.size}`
        );
      });

      ws.on("error", (error) => {
        this.logger.error("WebSocket client error:", error);
      });
    });
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (error) {
          this.logger.error("Error broadcasting to client:", error);
          this.clients.delete(client);
        }
      }
    }
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
    };
  }

  getConnectedClientsCount() {
    return this.clients.size;
  }

  async shutdown() {
    try {
      for (const client of this.clients) {
        try {
          client.close();
        } catch (error) {
          this.logger.error("Error closing client connection:", error);
        }
      }
      this.clients.clear();
      if (this.wss) {
        this.wss.close();
      }
      super.shutdown();
    } catch (error) {
      this.logger.error("Error during WebSocket server shutdown:", error);
      throw error;
    }
  }
}

module.exports = WebSocketServer;
