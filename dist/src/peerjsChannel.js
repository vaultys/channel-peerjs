import { Peer } from "peerjs";
import { CryptoChannel, crypto } from "@vaultys/id";
const { randomBytes } = crypto;
/** Signalling server used when nothing else is given (unchanged default, for backward compatibility). */
export const DEFAULT_HOST = "peerjs.92k.de";
const MAX_ICE_SERVERS = 4;
const MAX_ICE_LENGTH = 2048;
const ICE_SCHEME = /^(stun|stuns|turn|turns):[^\s]{1,253}$/;
const HOST = /^[A-Za-z0-9.-]{1,253}$/;
const PATH = /^\/[A-Za-z0-9._~\/-]{0,200}$/;
const KEY = /^[0-9a-f]{64}$/;
const b64url = (text) => crypto.Buffer.from(text, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (text) => crypto.Buffer.from(text.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
/** Strictly validates ICE servers coming from a connection string (a QR code is untrusted input). */
export function validIceServers(value) {
    if (!Array.isArray(value) || value.length > MAX_ICE_SERVERS)
        return null;
    const out = [];
    for (const server of value) {
        if (!server || typeof server !== "object")
            return null;
        const { urls, username, credential, ...rest } = server;
        if (Object.keys(rest).length)
            return null;
        const list = typeof urls === "string" ? [urls] : urls;
        if (!Array.isArray(list) || !list.length || list.length > MAX_ICE_SERVERS || !list.every((u) => typeof u === "string" && ICE_SCHEME.test(u)))
            return null;
        if (username !== undefined && (typeof username !== "string" || username.length > 256))
            return null;
        if (credential !== undefined && (typeof credential !== "string" || credential.length > 256))
            return null;
        out.push({ urls: urls, ...(username !== undefined ? { username } : {}), ...(credential !== undefined ? { credential } : {}) });
    }
    return out;
}
/**
 * Builds `vaultys://peerjs?key=…&host=…[&port=…][&path=…][&secure=0][&ice=…]`. `ice` is the base64url of the JSON
 * array of ICE servers. Older receivers ignore the new parameters and keep their previous behaviour.
 */
export function buildConnectionString(key, options = {}) {
    const params = new URLSearchParams({ key, host: options.host ?? DEFAULT_HOST });
    if (options.port !== undefined)
        params.set("port", String(options.port));
    if (options.path !== undefined && options.path !== "/")
        params.set("path", options.path);
    if (options.secure === false)
        params.set("secure", "0");
    if (options.iceServers !== undefined)
        params.set("ice", b64url(JSON.stringify(options.iceServers)));
    return `vaultys://peerjs?${params.toString()}`;
}
/** Parses a connection string ; `null` if it is not a PeerJS one or if any parameter is invalid (never a silent fallback). */
export function parseConnectionString(string) {
    if (!string.startsWith("vaultys://peerjs?"))
        return null;
    let url;
    try {
        url = new URL(string);
    }
    catch {
        return null;
    }
    const p = url.searchParams;
    const key = p.get("key");
    const host = p.get("host");
    if (!key || !KEY.test(key) || !host || !HOST.test(host))
        return null;
    const options = { host, secure: p.get("secure") !== "0" };
    const port = p.get("port");
    if (port !== null) {
        const n = Number(port);
        if (!Number.isInteger(n) || n < 1 || n > 65535)
            return null;
        options.port = n;
    }
    const path = p.get("path");
    if (path !== null) {
        if (!PATH.test(path))
            return null;
        options.path = path;
    }
    const ice = p.get("ice");
    if (ice !== null) {
        if (ice.length > MAX_ICE_LENGTH)
            return null;
        let parsed;
        try {
            parsed = JSON.parse(fromB64url(ice));
        }
        catch {
            return null;
        }
        const servers = validIceServers(parsed);
        if (!servers)
            return null;
        options.iceServers = servers;
    }
    return { key, options };
}
export class PeerjsChannel {
    /**
     * @param key shared secret (hex, 32 bytes) ; absent: a new one (initiator).
     * @param status initiator or receiver (default: receiver when a key is given).
     * @param hostOrOptions signalling host (former signature), or the full options.
     */
    constructor(key, status, hostOrOptions = DEFAULT_HOST) {
        /** Messages received while no receive() was pending (they used to be dropped). */
        this._queue = [];
        this._waiting = [];
        /** The data connection is open: start() resolves at once. */
        this._started = false;
        this.options = typeof hostOrOptions === "string" ? { host: hostOrOptions } : { ...hostOrOptions };
        this.host = this.options.host ?? DEFAULT_HOST;
        if (status) {
            this.status = status;
        }
        else {
            this.status = key ? "receiver" : "initiator";
        }
        this.otherstatus = this.status == "initiator" ? "receiver" : "initiator";
        this.key = key ?? randomBytes(32).toString("hex");
        this.id = crypto.hash("sha256", crypto.Buffer.from(`vaultys-${this.status}-${this.key}`)).toString("hex");
        this.otherid = crypto.hash("sha256", crypto.Buffer.from(`vaultys-${this.otherstatus}-${this.key}`)).toString("hex");
        const options = {
            debug: this.options.debug ?? 0,
            host: this.host,
            secure: this.options.secure ?? true,
            ...(this.options.port !== undefined ? { port: this.options.port } : {}),
            ...(this.options.path !== undefined ? { path: this.options.path } : {}),
            // Without `config`, PeerJS uses its own public STUN/TURN servers ; with it, ONLY the given ones.
            ...(this.options.iceServers !== undefined ? { config: { iceServers: this.options.iceServers } } : {}),
            logFunction: (level, ...rest) => {
                if (level.toString() === "Error:") {
                    this._onError?.(String(rest[0]));
                }
            },
        };
        this.peer = new Peer(this.id, options);
        // The logFunction above only runs when `debug` is at least 1: listen to the Peer's own errors as well, so that an
        // unreachable relay or an unknown peer rejects start() instead of leaving it pending forever.
        this.peer.on("error", (error) => {
            const type = error?.type;
            const message = type ? `peerjs: ${type}` : String(error);
            this._error ??= message;
            this._onError?.(message);
        });
        if (this.status == "initiator") {
            const that = this;
            that.peer.on("connection", (conn) => {
                that._onConnected?.();
                delete that._onConnected;
                that.conn = conn;
                that.conn.on("data", (data) => {
                    that._deliver(crypto.Buffer.from(data, "base64"));
                });
                that.conn.on("close", () => that.peer.destroy());
                // "connection" fires before the data channel is open: a message sent now would be lost.
                // Resolve start() only once the connection is open.
                if (conn.open)
                    that._markStarted();
                else
                    conn.once("open", () => that._markStarted());
            });
        }
        CryptoChannel.encryptChannel(this, crypto.Buffer.from(this.key, "hex"));
    }
    static fromConnectionString(string, options = {}) {
        const parsed = parseConnectionString(string);
        if (!parsed)
            return null;
        return new PeerjsChannel(parsed.key, "receiver", { ...parsed.options, ...options });
    }
    fromConnectionString(string, options) {
        return PeerjsChannel.fromConnectionString(string, options);
    }
    getConnectionString() {
        return buildConnectionString(this.key, { ...this.options, host: this.host });
    }
    onConnected(callback) {
        this._onConnected = callback;
    }
    async start() {
        const that = this;
        if (this.status === "receiver") {
            const connect = () => {
                that.conn = that.peer.connect(that.otherid, { reliable: true });
                that.conn.on("open", () => {
                    that._onConnected?.();
                    delete that._onConnected;
                    that.conn.on("data", (data) => {
                        that._deliver(crypto.Buffer.from(data, "base64"));
                    });
                    that.conn.on("close", () => that.peer.destroy());
                    that._markStarted();
                });
            };
            // Dial only once our own peer is registered with the signalling server: an offer sent before
            // that can be dropped, leaving start() pending forever.
            if (this.peer.open)
                connect();
            else
                this.peer.once("open", connect);
        }
        return new Promise((resolve, reject) => {
            // the initiator's connection may already be open when start() is called
            if (that._started)
                return resolve();
            if (that._error)
                return reject(that._error);
            that._onStarted = resolve;
            this._onError = reject;
        });
    }
    _markStarted() {
        this._started = true;
        this._onStarted?.();
    }
    /** Hands a message to the oldest pending receive(), or keeps it until the next one. */
    _deliver(data) {
        const waiting = this._waiting.shift();
        if (waiting)
            waiting(data);
        else
            this._queue.push(data);
    }
    async send(data) {
        this.conn.send(data.toString("base64"));
    }
    async receive() {
        const queued = this._queue.shift();
        if (queued)
            return queued;
        return new Promise((resolve) => this._waiting.push(resolve));
    }
    close() {
        if (this.conn) {
            this.conn.close();
        }
        this.peer.destroy();
        return Promise.resolve();
    }
}
