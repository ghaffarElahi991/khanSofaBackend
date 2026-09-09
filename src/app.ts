import express from "express";
import cors from "cors";
import productRoutes from "./routes/products";
import categoryRoutes from "./routes/categories";
import authRoutes from "./routes/auth";
import orderRoutes from "./routes/orders";
import reviewRoutes from "./routes/reviews";
import adminRoutes from "./routes/admin";
import adminPanelRoutes from "./routes/admin-panel";
import navRoutes from "./routes/nav";
import paymentsRoutes from "./routes/payments";
import paymentsWebhookRoutes from "./routes/payments-webhook";
import tagRoutes from "./routes/tags";
import newsletterRoutes from "./routes/newsletter";
import { setupSession } from "./lib/views";
import { errorHandler, notFoundHandler } from "./middleware/error";

import { requestLogger } from "./middleware/request-logger";

const app = express();
app.use(requestLogger);
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const allowedOrigins = (process.env.CORS_ORIGIN || frontendUrl)
  .split(",")
  .map((origin) => origin.trim());

setupSession(app);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), paymentsWebhookRoutes);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    name: "Khan Sofa API",
    version: "1.0.0",
    status: "running",
    docs: "/api",
    health: "/api/health",
    admin: "/admin",
    frontend: frontendUrl,
  });
});

app.get("/api", (_req, res) => {
  res.json({
    endpoints: {
      health: "GET /api/health",
      products: "GET /api/products",
      product: "GET /api/products/:id",
      categories: "GET /api/categories",
      reviews: "GET /api/reviews",
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      orders: "POST /api/orders",
      payments: "GET/POST /api/payments/*",
      admin: "GET /api/admin/* (requires admin JWT)",
    },
    adminPanel: "GET /admin (HTML + Bootstrap)",
  });
});

app.get("/api/health", async (_req, res) => {
  try {
    const { prisma } = await import("./lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", service: "khan-sofa-api", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", service: "khan-sofa-api", database: "disconnected" });
  }
});

// HTML admin panel (Bootstrap)
app.use("/admin", adminPanelRoutes);

// JSON API
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/nav", navRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
