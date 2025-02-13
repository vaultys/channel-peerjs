import { IWebRTCProvider } from "./abstract";

export class NodeWebRTC implements IWebRTCProvider {
  createConnection() {
    try {
      const wrtc = require("wrtc");
      return new wrtc.RTCPeerConnection();
    } catch (e) {
      throw new Error('WebRTC is not supported in this Node.js environment. Install "wrtc" package for WebRTC support.');
    }
  }
}
