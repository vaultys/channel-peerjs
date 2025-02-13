import { expect } from "chai";
import { IdManager, MemoryStorage, VaultysId } from "@vaultys/id";
import { PeerjsChannel } from "../src/peerjsChannel";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("PeerjsChannel tests", () => {
  it("Start and stop", async () => {
    const channel1 = new PeerjsChannel();
    const channel2 = new PeerjsChannel(channel1.key);

    const s1 = MemoryStorage(() => {});
    const s2 = MemoryStorage(() => {});
    const manager1 = new IdManager(await VaultysId.generatePerson(), s1);
    const manager2 = new IdManager(await VaultysId.generateMachine(), s2);

    await Promise.all([channel1.start(), channel2.start()]);

    await delay(2000);

    const [contact1, contact2] = await Promise.all([
      manager1.acceptContact(channel1),
      manager2.askContact(channel2),
    ]);

    expect(contact1.did).to.equal(manager2.vaultysId.did);
    expect(contact2.did).to.equal(manager1.vaultysId.did);

    expect(s1.list().length).to.equal(2);
    expect(s2.list().length).to.equal(2);

    expect(manager2.contacts.length).to.equal(1);
    expect(manager2.getContact(manager1.vaultysId.did)?.fingerprint).to.equal(
      manager1.vaultysId.fingerprint,
    );

    manager1.setContactMetadata(manager2.vaultysId.did, "name", "salut");
    manager1.setContactMetadata(manager2.vaultysId.did, "group", "pro");

    expect(
      manager1.getContactMetadata(manager2.vaultysId.did, "name"),
    ).to.equal("salut");
    expect(
      manager1.getContactMetadata(manager2.vaultysId.did, "group"),
    ).to.equal("pro");

    expect(await manager1.verifyRelationshipCertificate(manager2.vaultysId.did))
      .to.be.true;
    expect(await manager2.verifyRelationshipCertificate(manager1.vaultysId.did))
      .to.be.true;

    channel1.close();
    channel2.close();
  }).timeout(5000);
});
