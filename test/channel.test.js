import fetch from "node-fetch";
import WebSocket from "ws";
import FileReader from "filereader";
import assert from "assert";
import PeerjsChannel from "../src/peerjsChannel.js";
import { IdManager } from "../lib/vaultysid/src/IdManager.js";
import { VaultysId } from "../lib/vaultysid/src/VaultysId.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class StorageMock {
  constructor() {
    this.store = {};
    this.substores = [];
  }
  set(key, value) {
    this.store[key] = value;
  }

  get(key) {
    return this.store[key];
  }

  list() {
    return Object.keys(this.store);
  }

  save() {}

  substore(key) {
    if (!this.substores[key]) {
      this.substores[key] = new StorageMock();
    }
    return this.substores[key];
  }
}

describe("PeerjsChannel tests", () => {
  it("Start and stop", async () => {
    const channel1 = new PeerjsChannel(null, null, null, polyfills);
    const channel2 = new PeerjsChannel(channel1.key, null, null, polyfills);
    const s1 = new StorageMock();
    const s2 = new StorageMock();
    const manager1 = new IdManager(await VaultysId.generatePerson(), s1);
    const manager2 = new IdManager(await VaultysId.generateMachine(), s2);

    await Promise.all([channel1.start(), channel2.start()]);

    await delay(2000);

    const contacts = await Promise.all([manager1.acceptContact(channel1), manager2.askContact(channel2)]);

    console.log("tototot");

    assert.equal(contacts[0].did, manager2.vaultysId.did);
    assert.equal(contacts[1].did, manager1.vaultysId.did);

    assert.equal(Object.values(s1.store).length, 2);
    assert.equal(Object.values(s2.store).length, 2);

    assert.equal(manager2.contacts.length, 1);
    assert.equal(manager2.getContact(manager1.vaultysId.did).fingerprint, manager1.vaultysId.fingerprint);

    manager1.setContactMetadata(manager2.vaultysId.did, "name", "salut");
    manager1.setContactMetadata(manager2.vaultysId.did, "group", "pro");
    assert.equal(manager1.getContactMetadata(manager2.vaultysId.did, "name"), "salut");
    assert.equal(manager1.getContactMetadata(manager2.vaultysId.did, "group"), "pro");

    assert.ok(await manager1.verifyRelationshipCertificate(manager2.vaultysId.did));
    assert.ok(await manager2.verifyRelationshipCertificate(manager1.vaultysId.did));

    console.log("yo");

    channel1.close();
    channel2.close();
  }).timeout(5000);
});
