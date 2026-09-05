# AGENTREADY pitch

Every merchant is online. Very few are safe for an AI to actually buy from.

That is the gap AgentReady closes. We turn a Razorpay merchant catalog into an agent-readable storefront, where a buyer can say what they need in natural language and a merchant Growth Agent can improve the basket. But intelligence never becomes authority: product truth stays in the catalog, deterministic policy decides spend, Razorpay executes, and verified webhooks confirm.

In the Golden Demo, a buyer requests a fragrance-free sensitive-skin routine under ₹2,000. OpenAI returns only a Zod-validated intent—not prices or payment instructions. The commerce core resolves Neon SKU IDs, proposes a moisturizer as a transparent complement, then the policy engine sees the approval threshold and waits. The approval becomes a hash-bound mandate. Only after fresh price and inventory verification can a server create a Razorpay TEST order.

Then we break it on purpose. A server-side fixture moves an approved cart from ₹1,799 to ₹2,049. AgentReady returns `DENY`, writes the audit event and proves `razorpayActionCreated: false`. This is what safe autonomy looks like.

For growth, we run the same 500-session synthetic population through baseline and treatment. The current reproducible result is +12.8% simulated GMV with no budget or policy violations. We label it synthetic because trust requires that honesty too.

AgentReady gives Razorpay merchants an on-ramp to AI commerce: ACP-style sessions, MCP-safe tools, AP2-inspired mandates, Razorpay-native rails, and a judge-visible evidence chain. Creative intelligence for commerce; boring correctness for money.
