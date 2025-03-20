import { Peer } from "peerjs";
import { Channel, crypto } from "@vaultys/id";
export declare class PeerjsChannel implements Channel {
    host: string;
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
    constructor(key?: string, status?: "initiator" | "receiver", host?: string);
    static fromConnectionString(string: string): PeerjsChannel | null;
    fromConnectionString(string: string): PeerjsChannel | null;
    getConnectionString(): string;
    onConnected(callback: () => void): void;
    start(): Promise<void>;
    send(data: crypto.Buffer): Promise<void>;
    receive(): Promise<crypto.Buffer>;
    close(): Promise<void>;
}
