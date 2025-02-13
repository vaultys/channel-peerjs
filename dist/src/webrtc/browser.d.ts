import { IWebRTCProvider } from "./abstract";
export declare class BrowserWebRTC implements IWebRTCProvider {
    createConnection(): RTCPeerConnection;
}
