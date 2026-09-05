import { createHash, randomUUID } from "crypto";
import { AuditEvent } from "./types";

const canonicalize = (value: object) => JSON.stringify(value, Object.keys(value).sort());
export function auditHash(payload: Omit<AuditEvent, "currentHash">) { return createHash("sha256").update(`${canonicalize(payload)}${payload.previousHash}`).digest("hex"); }
export function appendAudit(input: Omit<AuditEvent, "id" | "timestamp" | "previousHash" | "currentHash">, previous?: AuditEvent): AuditEvent {
  const base = { ...input, id: randomUUID(), timestamp: new Date().toISOString(), previousHash: previous?.currentHash ?? "GENESIS" };
  return { ...base, currentHash: auditHash(base) };
}
export function verifyAuditChain(events: AuditEvent[]) { return events.every((event, index) => { const { currentHash, ...payload } = event; return event.previousHash === (index ? events[index - 1].currentHash : "GENESIS") && currentHash === auditHash(payload); }); }
