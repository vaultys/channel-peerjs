import { Peer } from "peerjs";
import { Channel, crypto } from "@vaultys/id";
/** Signalling server used when nothing else is given (unchanged default, for backward compatibility). */
export declare const DEFAULT_HOST = "peerjs.92k.de";
/** ICE server accepted in a connection string: STUN/TURN only, with optional TURN credentials. */
export interface IceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}
/**
 * Where the channel connects. Everything here is also carried by the connection string, so that the party who scans
 * the QR code (the receiver) uses the SAME signalling server and the SAME ICE servers as the party who created it
 * (the initiator), instead of PeerJS defaults.
 */
export interface PeerjsChannelOptions {
    /** PeerJS signalling server host (default `peerjs.92k.de`). */
    host?: string;
    /** Port of the signalling server (default: 443 when `secure`). */
    port?: number;
    /** Path of the PeerJS server (default `/`). */
    path?: string;
    /** Use TLS for signalling (default true). */
    secure?: boolean;
    /**
     * ICE servers given to WebRTC. Absent: PeerJS defaults (public STUN/TURN servers). `[]`: no STUN/TURN at all (host
     * candidates only: same network, or a peer with a public address).
     */
    iceServers?: IceServer[];
    /** PeerJS log level (0 none … 3 all, default 0). Message contents are never logged. */
    debug?: 0 | 1 | 2 | 3;
}
/** Fields of a parsed `vaultys://peerjs?…` connection string. */
export interface PeerjsConnection {
    key: string;
    options: Required<Pick<PeerjsChannelOptions, "host" | "secure">> & Omit<PeerjsChannelOptions, "host" | "secure" | "debug">;
}
/** Strictly validates ICE servers coming from a connection string (a QR code is untrusted input). */
export declare function validIceServers(value: unknown): IceServer[] | null;
/**
 * Builds `vaultys://peerjs?key=…&host=…[&port=…][&path=…][&secure=0][&ice=…]`. `ice` is the base64url of the JSON
 * array of ICE servers. Older receivers ignore the new parameters and keep their previous behaviour.
 */
export declare function buildConnectionString(key: string, options?: PeerjsChannelOptions): string;
/** Parses a connection string ; `null` if it is not a PeerJS one or if any parameter is invalid (never a silent fallback). */
export declare function parseConnectionString(string: string): PeerjsConnection | null;
export declare class PeerjsChannel implements Channel {
    host: string;
    options: PeerjsChannelOptions;
    status: "initiator" | "receiver";
    otherstatus: string;
    key: string;
    id: string;
    otherid: string;
    peer: Peer;
    conn: any;
    _onConnected?: () => void;
    _onStarted: () => void;
    _onError: (error: string) => void;
    _onData: (data: crypto.Buffer) => void;
    /** Messages received while no receive() was pending (they used to be dropped). */
    private _queue;
    private _waiting;
    /** The data connection is open: start() resolves at once. */
    private _started;
    /** First error reported by PeerJS (relay unreachable, unknown peer…), kept if it comes before start(). */
    _error?: string;
    /**
     * @param key shared secret (hex, 32 bytes) ; absent: a new one (initiator).
     * @param status initiator or receiver (default: receiver when a key is given).
     * @param hostOrOptions signalling host (former signature), or the full options.
     */
    constructor(key?: string, status?: "initiator" | "receiver", hostOrOptions?: string | PeerjsChannelOptions);
    static fromConnectionString(string: string, options?: Pick<PeerjsChannelOptions, "debug">): PeerjsChannel | null;
    fromConnectionString(string: string, options?: Pick<PeerjsChannelOptions, "debug">): PeerjsChannel | null;
    getConnectionString(): string;
    onConnected(callback: () => void): void;
    start(): Promise<void>;
    _markStarted(): void;
    /** Hands a message to the oldest pending receive(), or keeps it until the next one. */
    _deliver(data: crypto.Buffer): void;
    send(data: crypto.Buffer): Promise<void>;
    receive(): Promise<crypto.Buffer>;
    close(): Promise<void>;
}
