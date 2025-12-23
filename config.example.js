// Configuration for CVR Data Feed Overlay
// Copy this to config.js and modify the values as needed

const OVERLAY_CONFIG = {
  // API Configuration
  apiBaseUrl: "http://localhost:8080",
  websocketUrl: "ws://localhost:8081/api/v1/realtime",
  apiKey: "your-api-key-here", // Replace with your actual API key

  // Update Settings
  staticDataInterval: 10000, // How often to fetch world/avatar data (milliseconds)
  websocketReconnectDelay: 5000, // WebSocket reconnection delay (milliseconds)

  // Display Options
  showGameNetwork: true,
  showVoiceComms: true,
  showFPS: true,
  showWorldInfo: true,
  showAvatarInfo: true,

  // Visual Options
  highContrast: false, // Enable for better visibility
  animationsEnabled: true,

  // Debug Options
  enableDebug: true,
  logApiCalls: false,
  logWebSocketMessages: false,
};

// Export for use in overlay.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = OVERLAY_CONFIG;
} else {
  window.OVERLAY_CONFIG = OVERLAY_CONFIG;
}
