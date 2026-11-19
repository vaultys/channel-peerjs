import { expect } from "chai";
import { PeerjsChannel } from "../src/peerjsChannel";
// No network: the Peer's "error" event is emitted by hand, as PeerJS does for an unknown peer.
describe("PeerjsChannel errors (no network)", () => {
    it("a PeerJS error rejects start() even at debug level 0", async () => {
        const channel = new PeerjsChannel(undefined, "initiator", { host: "localhost", port: 9, secure: false });
        channel.peer.emit("error", Object.assign(new Error("Could not connect to peer"), { type: "peer-unavailable" }));
        let error;
        await channel.start().catch((e) => (error = e));
        expect(String(error)).to.contain("peer-unavailable");
        channel.peer.destroy();
    });
    it("an error after start() was called rejects it too", async () => {
        const channel = new PeerjsChannel(undefined, "initiator", { host: "localhost", port: 9, secure: false });
        const start = channel.start();
        channel.peer.emit("error", Object.assign(new Error("Lost connection to server"), { type: "network" }));
        let error;
        await start.catch((e) => (error = e));
        expect(String(error)).to.contain("network");
        channel.peer.destroy();
    });
});
