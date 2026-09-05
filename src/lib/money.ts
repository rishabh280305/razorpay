export const formatINR = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
export const sumPaise = (items: { unitPricePaise: number; quantity: number }[]) => items.reduce((sum, item) => sum + item.unitPricePaise * item.quantity, 0);
