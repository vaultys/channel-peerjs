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
    _onStarted: () => void;
    _onError: (error: string) => void;
    _onData: (data: Buffer) => void;
    constructor(key?: string, status?: "initiator" | "receiver", host?: string);
    static fromConnectionString(string: string): PeerjsChannel | null;
    fromConnectionString(string: string): PeerjsChannel | null;
    getConnectionString(): string;
    start(): Promise<void>;
    send(data: crypto.Buffer): Promise<void>;
    receive(): Promise<Buffer>;
    close(): Promise<void>;
}
