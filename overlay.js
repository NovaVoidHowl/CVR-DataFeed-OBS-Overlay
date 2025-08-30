// CVR Data Feed Overlay JavaScript
class CVROverlay {
  constructor(config = {}) {
    // Use provided config or fall back to global CONFIG or defaults
    const defaultConfig = {
      apiBaseUrl: "http://localhost:8080",
      websocketUrl: "ws://localhost:8081",
      apiKey: "your-api-key-here",
      staticDataInterval: 10000,
      websocketReconnectDelay: 5000,
    };

    this.config = { ...defaultConfig, ...config };
    this.apiBaseUrl = this.config.apiBaseUrl;
    this.wsUrl = this.config.websocketUrl;
    this.apiKey = this.config.apiKey;
    this.staticDataInterval = this.config.staticDataInterval;
    this.reconnectDelay = this.config.websocketReconnectDelay;

    this.isConnected = false;
    this.wsConnected = false;
    this.lastData = {};
    this.websocket = null;
    this.worldWebsocket = null;
    this.avatarWebsocket = null;
    this.reconnectInterval = null;

    this.init();
  }

  init() {
    console.log("CVR Overlay initializing...");
    this.connectWebSocket();
    this.connectChangeNotificationWebSockets();
    this.startStaticDataPolling();
    this.setupErrorHandling();
  }

  connectWebSocket() {
    try {
      console.log("Connecting to WebSocket:", this.wsUrl);

      // For browser WebSocket connections, we need to pass the API key via query string
      const wsUrlWithAuth = `${this.wsUrl}?api-key=${encodeURIComponent(
        this.apiKey,
      )}`;
      console.log("WebSocket URL with auth:", wsUrlWithAuth);

      this.websocket = new WebSocket(wsUrlWithAuth);

      this.websocket.onopen = () => {
        console.log("WebSocket connected");
        this.wsConnected = true;
        this.setConnectionStatus(true, "Connected (Live)");

        // Clear any reconnection attempts
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      };

      this.websocket.onmessage = (event) => {
        try {
          const realtimeData = JSON.parse(event.data);
          this.updateRealtimeData(realtimeData);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.websocket.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        this.wsConnected = false;

        if (event.code === 1008) {
          // Policy Violation (likely invalid API key)
          this.setConnectionStatus(false, "Invalid API Key");
          console.error("WebSocket closed due to invalid API key");
        } else {
          this.setConnectionStatus(false, "Reconnecting...");
          this.scheduleReconnect();
        }
      };

      this.websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.wsConnected = false;
        this.setConnectionStatus(false, "Connection Error");
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.scheduleReconnect();
    }
  }

  connectChangeNotificationWebSockets() {
    // Connect to world change notifications
    this.connectWorldWebSocket();
    // Connect to avatar change notifications
    this.connectAvatarWebSocket();
  }

  connectWorldWebSocket() {
    try {
      const worldWsUrl = this.wsUrl.replace(
        "/api/v1/realtime",
        "/api/v1/world",
      );
      const worldWsUrlWithAuth = `${worldWsUrl}?api-key=${encodeURIComponent(
        this.apiKey,
      )}`;
      console.log("Connecting to World WebSocket:", worldWsUrlWithAuth);

      this.worldWebsocket = new WebSocket(worldWsUrlWithAuth);

      this.worldWebsocket.onopen = () => {
        console.log("World WebSocket connected");
      };

      this.worldWebsocket.onmessage = (event) => {
        try {
          console.log("World change detected, refreshing static data...");
          // Immediately refresh static data when world changes
          this.updateStaticData();
        } catch (error) {
          console.error("Failed to handle world change:", error);
        }
      };

      this.worldWebsocket.onclose = () => {
        console.log("World WebSocket disconnected, attempting reconnect...");
        setTimeout(() => this.connectWorldWebSocket(), 5000);
      };

      this.worldWebsocket.onerror = (error) => {
        console.error("World WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to create World WebSocket:", error);
    }
  }

  connectAvatarWebSocket() {
    try {
      const avatarWsUrl = this.wsUrl.replace(
        "/api/v1/realtime",
        "/api/v1/avatar",
      );
      const avatarWsUrlWithAuth = `${avatarWsUrl}?api-key=${encodeURIComponent(
        this.apiKey,
      )}`;
      console.log("Connecting to Avatar WebSocket:", avatarWsUrlWithAuth);

      this.avatarWebsocket = new WebSocket(avatarWsUrlWithAuth);

      this.avatarWebsocket.onopen = () => {
        console.log("Avatar WebSocket connected");
      };

      this.avatarWebsocket.onmessage = (event) => {
        try {
          console.log("Avatar change detected, refreshing static data...");
          // Immediately refresh static data when avatar changes
          this.updateStaticData();
        } catch (error) {
          console.error("Failed to handle avatar change:", error);
        }
      };

      this.avatarWebsocket.onclose = () => {
        console.log("Avatar WebSocket disconnected, attempting reconnect...");
        setTimeout(() => this.connectAvatarWebSocket(), 5000);
      };

      this.avatarWebsocket.onerror = (error) => {
        console.error("Avatar WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to create Avatar WebSocket:", error);
    }
  }

  scheduleReconnect() {
    if (this.reconnectInterval) return; // Already scheduled

    console.log(`Scheduling WebSocket reconnect in ${this.reconnectDelay}ms`);
    this.reconnectInterval = setInterval(() => {
      if (!this.wsConnected) {
        this.connectWebSocket();
      }
    }, this.reconnectDelay);
  }

  async fetchWithApiKey(endpoint) {
    try {
      console.log(`Making request to: ${this.apiBaseUrl}${endpoint}`);
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      console.log(`Response status for ${endpoint}:`, response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Response data for ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error);
      throw error;
    }
  }

  async updateStaticData() {
    try {
      console.log("Fetching static data...");
      // Fetch static data (world and avatar info) via REST API
      const [instanceData, avatarData, worldData] = await Promise.all([
        this.fetchWithApiKey("/api/v1/instance"),
        this.fetchWithApiKey("/api/v1/avatar"),
        this.fetchWithApiKey("/api/v1/world"),
      ]);

      console.log("Instance data received:", instanceData);
      console.log("Avatar data received:", avatarData);
      console.log("World data received:", worldData);

      this.updateWorldData(instanceData, worldData);
      this.updateAvatarData(avatarData);

      // Only update connection status if WebSocket isn't handling it
      if (!this.wsConnected) {
        this.setConnectionStatus(true, "Connected (Polling)");
      }
      this.isConnected = true;
    } catch (error) {
      console.error("Failed to update static data:", error);
      // Only show error if WebSocket is also disconnected
      if (!this.wsConnected) {
        this.setConnectionStatus(false, "Connection Error");
        this.isConnected = false;
      }
    }
  }

  updateRealtimeData(data) {
    // Game Network Status
    this.updateValue("game-ping", data.currentPing || "--");
    this.updateValue("voice-ping", data.voiceCommsPing || "--");
    this.updateValue("fps", data.currentFPS || "--");
    this.updateValue("connection-state", data.connectionState || "Unknown");

    // Status indicators
    const gameStatus = document.getElementById("game-status");
    const voiceStatus = document.getElementById("voice-status");

    if (data.isConnected) {
      gameStatus.className = "status-indicator status-connected";
    } else if (data.dataFeedErrorNetworkManager) {
      gameStatus.className = "status-indicator status-error";
    } else {
      gameStatus.className = "status-indicator status-disconnected";
    }

    if (data.isVoiceConnected) {
      voiceStatus.className = "status-indicator status-connected";
    } else if (data.dataFeedErrorComms) {
      voiceStatus.className = "status-indicator status-error";
    } else {
      voiceStatus.className = "status-indicator status-disconnected";
    }
  }

  updateWorldData(instanceData, worldData = null) {
    console.log("Updating world data with instance:", instanceData);
    console.log("Updating world data with world:", worldData);

    // Use world data if available, otherwise fall back to instance data
    const data = instanceData;
    const details = worldData?.detailsAvailable ? worldData.worldDetails : null;

    console.log("World details from API:", details);

    const worldName = document.getElementById("world-name");
    const worldAuthor = document.getElementById("world-author");
    const worldTags = document.getElementById("world-tags");
    const instanceId = document.getElementById("instance-id");

    console.log("World elements found:", {
      worldName: !!worldName,
      worldAuthor: !!worldAuthor,
      worldTags: !!worldTags,
      instanceId: !!instanceId,
    });

    if (details && details.AuthorName) {
      console.log("World details from API found, updating UI...");
      // Use instance name for world name since world details don't contain world name
      worldName.textContent =
        instanceData.currentInstanceName || "Unknown World";
      worldAuthor.textContent = `by ${details.AuthorName || "Unknown"}`;

      // Show tags if available
      if (details.Tags && details.Tags.length > 0) {
        worldTags.textContent = details.Tags.slice(0, 3).join(", ");
      } else if (details.tags && details.tags.length > 0) {
        worldTags.textContent = details.tags.slice(0, 3).join(", ");
      } else {
        worldTags.textContent = "";
      }

      // Instance info
      instanceId.textContent = data.currentInstanceId || "No Instance";
    } else if (data.currentInstanceName) {
      console.log("World details not available, using instance info...");
      // Fall back to instance information
      worldName.textContent = data.currentInstanceName;
      worldAuthor.textContent = "ChilloutVR World";
      worldTags.textContent = data.currentInstancePrivacy || "";
      instanceId.textContent = data.currentInstanceId || "No Instance";
    } else {
      console.log("No world or instance data found, using defaults...");
      worldName.textContent = "Not Connected";
      worldAuthor.textContent = "--";
      worldTags.textContent = "--";
      instanceId.textContent = "--";
    }
  }

  updateAvatarData(data) {
    console.log("Updating avatar data with:", data);
    console.log("avatarDetails object:", data.avatarDetails);
    console.log("avatarDetails.name:", data.avatarDetails?.name);
    const avatarName = document.getElementById("avatar-name");
    const avatarAuthor = document.getElementById("avatar-author");
    const avatarTags = document.getElementById("avatar-tags");

    console.log("Avatar elements found:", {
      avatarName: !!avatarName,
      avatarAuthor: !!avatarAuthor,
      avatarTags: !!avatarTags,
    });

    if (
      data.avatarDetails &&
      (data.avatarDetails.AvatarName || data.avatarDetails.name)
    ) {
      console.log("Avatar details found, updating UI...");
      avatarName.textContent =
        data.avatarDetails.AvatarName ||
        data.avatarDetails.name ||
        "Unknown Avatar";
      avatarAuthor.textContent = `by ${
        data.avatarDetails.AuthorName || "Unknown"
      }`;

      // Show tags if available
      if (data.avatarDetails.Tags && data.avatarDetails.Tags.length > 0) {
        avatarTags.textContent = data.avatarDetails.Tags.slice(0, 3).join(", ");
      } else if (
        data.avatarDetails.tags &&
        data.avatarDetails.tags.length > 0
      ) {
        avatarTags.textContent = data.avatarDetails.tags.slice(0, 3).join(", ");
      } else {
        avatarTags.textContent = "";
      }
    } else {
      console.log("No avatar details found, using defaults...");
      avatarName.textContent = "Not Loaded";
      avatarAuthor.textContent = "--";
      avatarTags.textContent = "--";
    }
  }

  updateValue(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (element && element.textContent !== newValue.toString()) {
      element.textContent = newValue;
      // Add flash animation for updated values
      element.classList.add("value-updated");
      setTimeout(() => element.classList.remove("value-updated"), 300);
    }
  }

  setConnectionStatus(connected, statusText) {
    const statusDot = document.getElementById("status-dot");
    const statusTextElement = document.getElementById("status-text");

    statusTextElement.textContent = statusText;

    if (connected) {
      statusDot.className = "status-dot status-connected";
    } else {
      statusDot.className = "status-dot status-error";
    }
  }

  startStaticDataPolling() {
    // Initial update for static data
    this.updateStaticData();

    // Set up polling interval for static data only
    setInterval(() => {
      this.updateStaticData();
    }, this.staticDataInterval);
  }

  setupErrorHandling() {
    window.addEventListener("error", (event) => {
      console.error("Overlay error:", event.error);
      this.setConnectionStatus(false, "Script Error");
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      this.setConnectionStatus(false, "Connection Error");
    });

    // Handle page visibility changes to reconnect WebSocket if needed
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        if (!this.wsConnected) {
          console.log("Page became visible, attempting WebSocket reconnect");
          this.connectWebSocket();
        }
        // Also check change notification WebSockets
        if (
          !this.worldWebsocket ||
          this.worldWebsocket.readyState !== WebSocket.OPEN
        ) {
          console.log("Reconnecting World WebSocket");
          this.connectWorldWebSocket();
        }
        if (
          !this.avatarWebsocket ||
          this.avatarWebsocket.readyState !== WebSocket.OPEN
        ) {
          console.log("Reconnecting Avatar WebSocket");
          this.connectAvatarWebSocket();
        }
      }
    });
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.worldWebsocket) {
      this.worldWebsocket.close();
      this.worldWebsocket = null;
    }

    if (this.avatarWebsocket) {
      this.avatarWebsocket.close();
      this.avatarWebsocket = null;
    }

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    this.wsConnected = false;
    this.isConnected = false;
  }
}

// Configuration object - modify these values as needed
const CONFIG = {
  API_BASE_URL: "http://localhost:8080",
  WEBSOCKET_URL: "ws://localhost:8081",
  API_KEY: "your-api-key-here", // Set this to match your DataFeed mod API key
  STATIC_DATA_INTERVAL: 10000, // 10 seconds for world/avatar data
  WEBSOCKET_RECONNECT_DELAY: 5000, // 5 seconds
  ENABLE_DEBUG: true,
};

// Initialize overlay when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Try to use OVERLAY_CONFIG if it exists, otherwise fall back to CONFIG
  const config = window.OVERLAY_CONFIG || CONFIG || {};
  const overlay = new CVROverlay(config);

  // Make overlay globally accessible for debugging
  if (config.enableDebug || CONFIG.ENABLE_DEBUG) {
    window.cvrOverlay = overlay;
  }

  console.log("CVR Data Feed Overlay loaded successfully with config:", config);
});

// Utility functions for OBS interaction
window.obsOverlayUtils = {
  // Function to manually refresh static data
  refreshStatic: () => {
    if (window.cvrOverlay) {
      window.cvrOverlay.updateStaticData();
    }
  },

  // Function to reconnect WebSocket
  reconnectWebSocket: () => {
    if (window.cvrOverlay) {
      window.cvrOverlay.connectWebSocket();
    }
  },

  // Function to disconnect everything
  disconnect: () => {
    if (window.cvrOverlay) {
      window.cvrOverlay.disconnect();
    }
  },

  // Function to update configuration
  updateConfig: (newConfig) => {
    Object.assign(CONFIG, newConfig);
    console.log("Configuration updated:", CONFIG);
  },

  // Function to get current status
  getStatus: () => {
    return {
      connected: window.cvrOverlay?.isConnected || false,
      wsConnected: window.cvrOverlay?.wsConnected || false,
      lastUpdate: new Date().toISOString(),
      config: CONFIG,
    };
  },
};
