import { Peer, PeerOptions } from "peerjs";
import { CryptoChannel, crypto } from "@vaultyshq/id";
const { hash, randomBytes } = crypto;

declare global {
  var Swal: {
    fire: ({
      title,
      text,
      icon,
      showCancelButton,
    }: {
      title?: string;
      text?: string;
      html?: string;
      icon?: string;
      showCancelButton?: boolean;
      allowOutsideClick?: boolean;
    }) => Promise<{ isConfirmed?: boolean }>;
    showLoading: () => void;
  };
}

export class PeerjsChannel {
  host: string;
  status: "initiator" | "receiver";
  otherstatus: string;
  key: string;
  id: string;
  otherid: string;
  peer: Peer;
  conn: any;
  _onStarted!: () => void;
  _onData!: (data: Buffer) => void;

  constructor(key?: string, status?: "initiator" | "receiver", host = "peerjs.92k.de") {
    this.host = host;
    if (status) {
      this.status = status;
    } else {
      this.status = key ? "receiver" : "initiator";
    }
    this.otherstatus = this.status == "initiator" ? "receiver" : "initiator";
    this.key = key ?? randomBytes(32).toString("hex");
    this.id = hash("sha256", Buffer.from(`vaultys-${this.status}-${this.key}`)).toString("hex");
    this.otherid = crypto.hash("sha256", Buffer.from(`vaultys-${this.otherstatus}-${this.key}`)).toString("hex");
    const options: PeerOptions = {
      debug: 2,
      host: this.host,
      secure: true,
      logFunction: (level, ...rest) => console.log(level.toString(), rest),
    };
    this.peer = new Peer(this.id, options);
    if (this.status == "initiator") {
      const that = this;
      that.peer.on("connection", (conn) => {
        console.log("connection");
        that.conn = conn;
        that.conn.on("data", (data: string) => {
          console.log("receiving: ", data);
          that._onData(Buffer.from(data, "base64"));
        });
        that.conn.on("close", () => that.peer.destroy());
        //console.log("_onStarted call", that);
        that._onStarted();
      });
    }
    CryptoChannel.encryptChannel(this, Buffer.from(this.key, "hex"));
  }

  static fromConnectionString(string: string) {
    if (string.startsWith("vaultys://peerjs?")) {
      const url = new URL(string);
      const key = url.searchParams.get("key");
      const host = url.searchParams.get("host");
      if (!key || !host) return null;
      return new PeerjsChannel(key, "receiver", host);
    }
    return null;
  }

  fromConnectionString(string: string) {
    return PeerjsChannel.fromConnectionString(string);
  }

  getConnectionString() {
    return `vaultys://peerjs?key=${this.key}&host=${this.host}`;
  }

  async start() {
    const that = this;
    //console.log(that);
    if (this.status === "receiver") {
      const result = Swal
        ? await Swal.fire({
            title: "New contact incoming",
            text: "Do you want to accept this new contact ?",
            icon: "info",
            showCancelButton: true,
          })
        : { isConfirmed: true };
      if (!result.isConfirmed) {
        that.close();
      } else {
        Swal &&
          Swal.fire({
            title: "Please Wait !",
            html: "Contacting through a secure Tunnel",
            allowOutsideClick: false,
          });
        Swal && Swal.showLoading();
        this.conn = this.peer.connect(this.otherid);
        that.conn.on("open", (id: string) => {
          console.log("open PeerJS Channel - ", id);
          that.conn.on("data", (data: string) => {
            console.log("receiving: ", data);
            that._onData(Buffer.from(data, "base64"));
          });
          that.conn.on("close", () => that.peer.destroy());
          //console.log("_onStarted call", that);
          that._onStarted();
        });
      }
    }
    return new Promise<void>((resolve) => (that._onStarted = resolve));
  }

  send(data: Buffer) {
    console.log("sending: ", data);
    this.conn.send(data.toString("base64"));
  }

  async receive(): Promise<Buffer> {
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
