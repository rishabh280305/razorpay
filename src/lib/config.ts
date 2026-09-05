export const integrationStatus = {
  database: Boolean(process.env.DATABASE_URL),
  ai: Boolean(process.env.OPENAI_API_KEY),
  razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  webhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)
};

export const isTestKey = () => (process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_test_");
