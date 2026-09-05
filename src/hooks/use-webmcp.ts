"use client";
import { useEffect } from "react";

type ModelContext = { registerTool(tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute(input: unknown): unknown | Promise<unknown> }, options: { signal: AbortSignal }): void | Promise<void> };

export function useWebMcp(actions: { startGoldenDemo: () => void; runPriceDriftDemo: () => void; navigate: (workspace: string) => boolean }) {
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext["registerTool"]>[0]) => Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    void register({ name: "start_agentready_golden_demo", title: "Start Golden Demo", description: "Open the Buyer Agent and start the visible bounded-commerce Golden Demo.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: () => { actions.startGoldenDemo(); return { workspace: "Buyer Agent", started: true }; } });
    void register({ name: "run_agentready_price_drift_demo", title: "Run Price Drift Failure", description: "Open the Chaos Lab and visibly demonstrate a price change being blocked before a Razorpay action.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: () => { actions.runPriceDriftDemo(); return { workspace: "Chaos Lab", decision: "DENY", reasonCodes: ["PRICE_CHANGED", "BUDGET_EXCEEDED"], razorpayActionCreated: false }; } });
    void register({ name: "navigate_agentready_workspace", title: "Open AgentReady Workspace", description: "Navigate the visible app to a named AgentReady workspace.", inputSchema: { type: "object", properties: { workspace: { type: "string", enum: ["Overview", "Buyer Agent", "Catalog", "Policies", "Protocol Lab", "Audit Trail", "Growth Eval", "Chaos Lab", "Developer", "Integrations", "Judge Mode"] } }, required: ["workspace"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const workspace = typeof input === "object" && input ? String((input as { workspace?: unknown }).workspace ?? "") : ""; if (!actions.navigate(workspace)) throw new Error("Unknown AgentReady workspace"); return { workspace, visible: true }; } });
    return () => lifecycle.abort();
  }, [actions]);
}
