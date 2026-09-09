const FREE_SHIPPING_MIN = 2500;
const STANDARD_SHIPPING = 149;

export function calculateShipping(subtotal: number) {
  if (subtotal >= FREE_SHIPPING_MIN) {
    return { shippingCost: 0, freeShipping: true };
  }
  return { shippingCost: STANDARD_SHIPPING, freeShipping: false };
}

export function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `KS-${y}${m}${d}-${rand}`;
}

export const PAYMENT_METHODS = [
  {
    id: "BANK_TRANSFER" as const,
    label: "Bank Transfer",
    description: "Pay via wire transfer. Instructions sent after you place your order.",
  },
  {
    id: "WHATSAPP" as const,
    label: "WhatsApp",
    description: "Complete payment through our WhatsApp concierge team.",
  },
  {
    id: "CARD" as const,
    label: "Credit / Debit Card",
    description: "Our team will contact you to securely complete card payment.",
  },
];

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];
