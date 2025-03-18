import { Peer } from "peerjs";
import { CryptoChannel, crypto } from "@vaultys/id";
const { randomBytes } = crypto;
export class PeerjsChannel {
    constructor(key, status, host = "peerjs.92k.de") {
        this.host = host;
        if (status) {
            this.status = status;
        }
        else {
            this.status = key ? "receiver" : "initiator";
        }
        this.otherstatus = this.status == "initiator" ? "receiver" : "initiator";
        this.key = key ?? randomBytes(32).toString("hex");
        this.id = crypto
            .hash("sha256", crypto.Buffer.from(`vaultys-${this.status}-${this.key}`))
            .toString("hex");
        this.otherid = crypto
            .hash("sha256", crypto.Buffer.from(`vaultys-${this.otherstatus}-${this.key}`))
            .toString("hex");
        const options = {
            debug: 2,
            host: this.host,
            secure: true,
            logFunction: (level, ...rest) => {
                console.log(level.toString(), rest);
                if (level.toString() === "Error:") {
                    this._onError(rest[0]);
                }
            },
        };
        this.peer = new Peer(this.id, options);
        if (this.status == "initiator") {
            const that = this;
            that.peer.on("connection", (conn) => {
                console.log("PeerJs connection incoming...");
                that.conn = conn;
                that.conn.on("data", (data) => {
                    console.log("receiving: ", data);
                    that._onData(crypto.Buffer.from(data, "base64"));
                });
                that.conn.on("close", () => that.peer.destroy());
                //console.log("_onStarted call", that);
                that._onStarted();
            });
        }
        CryptoChannel.encryptChannel(this, crypto.Buffer.from(this.key, "hex"));
    }
    static fromConnectionString(string) {
        if (string.startsWith("vaultys://peerjs?")) {
            const url = new URL(string);
            const key = url.searchParams.get("key");
            const host = url.searchParams.get("host");
            if (!key || !host)
                return null;
            return new PeerjsChannel(key, "receiver", host);
        }
        return null;
    }
    fromConnectionString(string) {
        return PeerjsChannel.fromConnectionString(string);
    }
    getConnectionString() {
        return `vaultys://peerjs?key=${this.key}&host=${this.host}`;
    }
    async start() {
        const that = this;
        if (this.status === "receiver") {
            this.conn = this.peer.connect(this.otherid);
            that.conn.on("open", (id) => {
                console.log("opening PeerJS Channel...");
                that.conn.on("data", (data) => {
                    console.log("receiving: ", data);
                    that._onData(crypto.Buffer.from(data, "base64"));
                });
                that.conn.on("close", () => that.peer.destroy());
                that._onStarted();
            });
        }
        return new Promise((resolve, reject) => {
            that._onStarted = resolve;
            this._onError = reject;
        });
    }
    async send(data) {
        console.log("sending: ", data.toString("base64"));
        this.conn.send(data.toString("base64"));
    }
    async receive() {
        const that = this;
        return new Promise((resolve) => (that._onData = resolve));
    }
    close() {
        if (this.conn) {
            this.conn.close();
        }
        this.peer.destroy();
        return Promise.resolve();
    }
}
