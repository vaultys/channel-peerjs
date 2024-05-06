import { Channel } from "@/lib/vaultysid";

export class PeerjsChannel extends Channel {
    constructor(key?: string, status?: "receiver" | "initiator", host?: string);
};