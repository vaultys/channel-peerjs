
import peerjs from 'peerjs';
import { CryptoChannel, crypto } from '@vaultyshq/id';

const Peer = peerjs.Peer ? peerjs.Peer : peerjs;

export class PeerjsChannel {
  constructor(key, status, host = "peerjs.92k.de") {
    this.host = host;
    if (status) {
      this.status = status;
    } else {
      this.status = key ? "receiver" : "initiator";
    }
    this.otherstatus = (this.status == "initiator") ? "receiver" : "initiator";
    this.key = key ? key : crypto.randomBytes(32).toString("hex");
    this.id = crypto.hash("sha256", Buffer.from(`vaultys-${this.status}-${this.key}`)).toString("hex");
    this.otherid = crypto.hash("sha256", Buffer.from(`vaultys-${this.otherstatus}-${this.key}`)).toString("hex");
    const options = { polyfills, debug: 2 };
    options.host = this.host;
    options.secure = true;
    this.peer = new Peer(this.id, options);
    if (this.status == "initiator") {
      const that = this;
      that.peer.on("connection", (conn) => {
        console.log("connection");
        that.conn = conn;
        that.conn.on("data", (data) => {
          //console.log("data", data);
          that._onData(data);
        });
        that.conn.on("close", () => that.peer.destroy());
        //console.log("_onStarted call", that);
        that._onStarted();
      });
    }
    CryptoChannel.encryptChannel(this, Buffer.from(this.key, "hex"));
  }

  static fromConnectionString(string) {
    if(string.startsWith('vaultys://peerjs?')) {
      const url = new URL(string);
      const key = url.searchParams.get('key');
      const host = url.searchParams.get('host');
      return new PeerjsChannel(key, "receiver", host);
    }
    return null;
  }

  getConnectionString() {
    return `vaultys://peerjs?key=${this.key}&host=${this.host}`;
  }

  async start() {
    const that = this;
    //console.log(that);
    if (this.status === "receiver") {
      const result = Swal ? await Swal.fire({
        title: "New contact incoming",
        text: "Do you want to accept this new contact ?",
        icon: "info",
        showCancelButton: true,
      }) : {isConfirmed: true};
      if (!result.isConfirmed) {
        that.close();
      } else {
        Swal && Swal.fire({
          title: "Please Wait !",
          html: "Contacting through a secure Tunnel",
          allowOutsideClick: false,
        });
        Swal && Swal.showLoading();
        this.conn = this.peer.connect(this.otherid);
        that.conn.on("open", (id) => {
          console.log("open");
          that.conn.on("data", (data) => {
            //console.log("data", data);
            that._onData(data);
          });
          that.conn.on("close", () => that.peer.destroy());
          //console.log("_onStarted call", that);
          that._onStarted();
        });
      }
    }
    return new Promise((resolve) => (that._onStarted = resolve));
  }

  send(data) {
    this.conn.send(data);
  }

  async receive() {
    const that = this;
    return new Promise((resolve) => {
      that._onData = resolve;
    });
  }

  close() {
    if (this.conn) {
      this.conn.close();
    }
    this.peer.destroy();
  }
}
