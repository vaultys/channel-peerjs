import { expect } from "chai";
import { EventEmitter } from "events";
import { crypto } from "@vaultys/id";
import { PeerjsChannel } from "../src/peerjsChannel";

// No signalling server and no WebRTC here: the PeerJS objects are replaced by plain event emitters, so that these
// tests only check the channel's own ordering logic.

class FakeConnection extends EventEmitter {
  open = false;
  sent: string[] = [];
  send(data: string) {
    if (!this.open) throw new Error("sent before the data channel was open");
    this.sent.push(data);
  }
  close() {}
}

class FakePeer extends EventEmitter {
  open = true;
  connection = new FakeConnection();
  connect() {
    return this.connection;
  }
  destroy() {}
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The real Peer reports "browser-incompatible" under Node: drop it, it is replaced by the fake one. */
function forgetRealPeer(channel: PeerjsChannel) {
  (channel as unknown as { _error?: string })._error = undefined;
}

/** An initiator whose real Peer is swapped for a fake one; the "connection" listener is re-registered on it. */
function initiator() {
  const channel = new PeerjsChannel(undefined, "initiator");
  (channel.peer as unknown as EventEmitter).removeAllListeners("error");
  channel.peer.destroy();
  const fake = new FakePeer();
  const listeners = (channel.peer as unknown as EventEmitter).listeners("connection");
  for (const listener of listeners) fake.on("connection", listener as (...args: unknown[]) => void);
  (channel as unknown as { peer: FakePeer }).peer = fake;
  forgetRealPeer(channel);
  return { channel, fake };
}

function receiver(key: string) {
  const channel = new PeerjsChannel(key, "receiver");
  (channel.peer as unknown as EventEmitter).removeAllListeners("error");
  channel.peer.destroy();
  const fake = new FakePeer();
  (channel as unknown as { peer: FakePeer }).peer = fake;
  forgetRealPeer(channel);
  return { channel, fake };
}

describe("PeerjsChannel ordering (no network)", () => {
  it("initiator: start() waits for the data channel, not only for the incoming connection", async () => {
    const { channel, fake } = initiator();
    let started = false;
    const start = channel.start().then(() => (started = true));
    const conn = new FakeConnection();
    fake.emit("connection", conn);
    await tick();
    expect(started).to.equal(false);
    conn.open = true;
    conn.emit("open");
    await start;
    await channel.send(crypto.Buffer.from("hello"));
    expect(conn.sent).to.have.length(1);
  });

  it("initiator: start() called after the connection is already open still resolves", async () => {
    const { channel, fake } = initiator();
    const conn = new FakeConnection();
    conn.open = true;
    fake.emit("connection", conn);
    await channel.start();
  });

  it("a message that arrives before receive() is kept, and messages keep their order", async () => {
    const { channel: a, fake } = initiator();
    const { channel: b } = receiver(a.key);
    const conn = new FakeConnection();
    conn.open = true;
    fake.emit("connection", conn);
    await a.start();
    // what b would send, encrypted under the shared key, delivered twice before anyone listens
    const outgoing = new FakeConnection();
    outgoing.open = true;
    (b as unknown as { conn: FakeConnection }).conn = outgoing;
    await b.send(crypto.Buffer.from("first"));
    await b.send(crypto.Buffer.from("second"));
    for (const data of outgoing.sent) conn.emit("data", data);
    expect((await a.receive()).toString()).to.equal("first");
    expect((await a.receive()).toString()).to.equal("second");
  });

  it("a pending receive() gets the next message", async () => {
    const { channel: a, fake } = initiator();
    const { channel: b } = receiver(a.key);
    const conn = new FakeConnection();
    conn.open = true;
    fake.emit("connection", conn);
    await a.start();
    const pending = a.receive();
    const outgoing = new FakeConnection();
    outgoing.open = true;
    (b as unknown as { conn: FakeConnection }).conn = outgoing;
    await b.send(crypto.Buffer.from("late"));
    conn.emit("data", outgoing.sent[0]);
    expect((await pending).toString()).to.equal("late");
  });
});
