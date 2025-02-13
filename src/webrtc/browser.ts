import { IWebRTCProvider } from "./abstract";

export class BrowserWebRTC implements IWebRTCProvider {
  createConnection() {
    return new RTCPeerConnection();
  }
}
