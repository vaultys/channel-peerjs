import { expect } from "chai";
import { buildConnectionString, DEFAULT_HOST, parseConnectionString, validIceServers } from "../src/peerjsChannel";

// No network: only the connection string, which travels in the QR code and must be strictly checked.
const KEY = "a".repeat(64);

describe("PeerJS connection string", () => {
  it("keeps the former format when only a host is given (older receivers unaffected)", () => {
    expect(buildConnectionString(KEY, { host: "peer.example.org" })).to.equal(`vaultys://peerjs?key=${KEY}&host=peer.example.org`);
    expect(buildConnectionString(KEY)).to.equal(`vaultys://peerjs?key=${KEY}&host=${DEFAULT_HOST}`);
    expect(parseConnectionString(`vaultys://peerjs?key=${KEY}&host=peer.example.org`)).to.deep.equal({ key: KEY, options: { host: "peer.example.org", secure: true } });
  });

  it("carries port, path, secure and ICE servers to the receiver (round trip)", () => {
    const options = {
      host: "peer.example.org",
      port: 9443,
      path: "/vaultys",
      secure: false,
      iceServers: [{ urls: "stun:stun.example.org:3478" }, { urls: ["turns:turn.example.org:5349"], username: "u", credential: "p" }],
    };
    const text = buildConnectionString(KEY, options);
    expect(text).to.match(/&port=9443&path=%2Fvaultys&secure=0&ice=[A-Za-z0-9_-]+$/);
    expect(parseConnectionString(text)).to.deep.equal({ key: KEY, options });
  });

  it("can say « no STUN/TURN at all » (empty list), instead of PeerJS public servers", () => {
    const parsed = parseConnectionString(buildConnectionString(KEY, { host: "peer.example.org", iceServers: [] }));
    expect(parsed?.options.iceServers).to.deep.equal([]);
  });

  it("refuses anything invalid instead of falling back silently to public servers", () => {
    const base = `vaultys://peerjs?key=${KEY}&host=peer.example.org`;
    const ice = (value: unknown) => `${base}&ice=${Buffer.from(JSON.stringify(value)).toString("base64url")}`;
    for (const bad of [
      `vaultys://other?key=${KEY}&host=h`,
      `vaultys://peerjs?key=short&host=peer.example.org`,
      `vaultys://peerjs?key=${KEY}`,
      `vaultys://peerjs?key=${KEY}&host=bad host`,
      `${base}&port=0`,
      `${base}&port=70000`,
      `${base}&path=noslash`,
      `${base}&ice=@@@`,
      ice({ urls: "stun:x" }),
      ice([{ urls: "https://evil.example" }]),
      ice([{ urls: "stun:a" }, { urls: "stun:b" }, { urls: "stun:c" }, { urls: "stun:d" }, { urls: "stun:e" }]),
      ice([{ urls: "stun:a", extra: 1 }]),
      `${base}&ice=${"A".repeat(3000)}`,
    ]) {
      expect(parseConnectionString(bad), bad).to.equal(null);
    }
  });

  it("validates ICE servers strictly", () => {
    expect(validIceServers([{ urls: "turn:t.example.org", username: "u", credential: "c" }])).to.deep.equal([{ urls: "turn:t.example.org", username: "u", credential: "c" }]);
    expect(validIceServers([{ urls: [] }])).to.equal(null);
    expect(validIceServers([{ urls: "stun:a", username: 3 }])).to.equal(null);
    expect(validIceServers("stun:a")).to.equal(null);
  });
});
