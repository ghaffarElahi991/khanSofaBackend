import { z } from "zod";
import { prisma } from "./prisma";
import { calculateShipping, generateOrderNumber } from "./order-utils";

export const paymentMethodEnum = z.enum(["BANK_TRANSFER", "WHATSAPP", "CARD"]);

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().regex(/^[+0-9().\s-]+$/, "Enter a valid phone number")
    .refine((value) => { const digits = value.replace(/\D/g, "").length; return digits >= 7 && digits <= 15; }, "Phone number must contain 7–15 digits"),
  shippingAddress: z.string().trim().min(5),
  city: z.string().trim().min(2),
  state: z.string().optional(),
  country: z.string().trim().min(2),
  postalCode: z.string().optional(),
  billingSameAsShipping: z.boolean().default(true),
  billingAddress: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingCountry: z.string().optional(),
  billingPostalCode: z.string().optional(),
  paymentMethod: paymentMethodEnum,
  orderNotes: z.string().optional(),
  couponCode: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.number(),
        quantity: z.number().min(1),
        color: z.string().optional(),
        configuration: z.string().optional(),
      })
    )
    .min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

const orderInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, primaryImageUrl: true } },
    },
  },
} as const;

export function serializeOrder(order: {
  subtotal: { toString(): string } | number;
  shippingCost: { toString(): string } | number;
  discount: { toString(): string } | number;
  total: { toString(): string } | number;
  items: Array<{
    price: { toString(): string } | number;
    product: { id: number; name: string; primaryImageUrl: string };
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    discount: Number(order.discount),
    total: Number(order.total),
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  };
}

export async function restoreOrderStock(orderId: number) {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  await prisma.$transaction(
    items.map((item) =>
      prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
    )
  );
}

export async function createOrder(data: CreateOrderInput, userId?: number) {
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  if (products.length !== productIds.length) {
    throw new Error("One or more products not found");
  }

  const productMap = new Map(products.map((p) => [p.id, p] as const));
  let subtotal = 0;

  for (const item of data.items) {
    const product = productMap.get(item.productId)!;
    if (product.stock < item.quantity) {
      throw new Error(
        `Insufficient stock for "${product.name}". Only ${product.stock} available.`
      );
    }
    subtotal += Number(product.price) * item.quantity;
  }

  let discount = 0;
  if (data.couponCode) {
    const coupon = await prisma.coupon.findFirst({
      where: {
        code: data.couponCode.toUpperCase(),
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (coupon) {
      discount =
        coupon.discountType === "percent"
          ? subtotal * (Number(coupon.discountValue) / 100)
          : Number(coupon.discountValue);
    }
  }

  const { shippingCost } = calculateShipping(subtotal);
  const total = Math.max(subtotal + shippingCost - discount, 0);

  const billing = data.billingSameAsShipping
    ? {
        billingAddress: data.shippingAddress,
        billingCity: data.city,
        billingState: data.state || null,
        billingCountry: data.country,
        billingPostalCode: data.postalCode || null,
      }
    : {
        billingAddress: data.billingAddress || data.shippingAddress,
        billingCity: data.billingCity || data.city,
        billingState: data.billingState || null,
        billingCountry: data.billingCountry || data.country,
        billingPostalCode: data.billingPostalCode || null,
      };

  const orderItems = data.items.map((item) => {
    const product = productMap.get(item.productId)!;
    return {
      productId: item.productId,
      quantity: item.quantity,
      price: product.price,
      color: item.color,
      configuration: item.configuration,
      productName: product.name,
      unitPrice: Number(product.price),
    };
  });

  const order = await prisma.$transaction(async (tx) => {
    for (const item of data.items) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        const product = productMap.get(item.productId)!;
        throw new Error(`Insufficient stock for "${product.name}"`);
      }
    }

    return tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        shippingAddress: data.shippingAddress,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        billingSameAsShipping: data.billingSameAsShipping,
        ...billing,
        paymentMethod: data.paymentMethod,
        paymentStatus: "PENDING",
        orderNotes: data.orderNotes,
        subtotal,
        shippingCost,
        discount,
        total,
        couponCode: data.couponCode?.toUpperCase(),
        items: {
          create: orderItems.map(({ productName, unitPrice, ...item }) => item),
        },
      },
      include: orderInclude,
    });
  });

  return { order, orderItems, subtotal, shippingCost, discount, total };
}

export async function attachStripeSession(orderId: number, stripeSessionId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { stripeSessionId },
    include: orderInclude,
  });
}

export async function markOrderPaid(orderId: number, stripePaymentIntentId?: string | null) {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "PAID",
      status: "CONFIRMED",
      stripePaymentIntentId: stripePaymentIntentId || null,
    },
    include: orderInclude,
  });
}

export async function cancelUnpaidOrder(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentStatus === "PAID" || order.status === "CANCELLED") {
    return null;
  }

  await restoreOrderStock(orderId);
  return prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED", paymentStatus: "FAILED" },
    include: orderInclude,
  });
}
