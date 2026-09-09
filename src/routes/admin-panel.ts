import { randomBytes } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { renderAdmin } from "../lib/views";
import { importProductsFromCsv, importProductsFromCsvFresh } from "../lib/import-products";
import {
  requireAdminPage,
  redirectIfLoggedIn,
  AdminSession,
} from "../middleware/admin-session";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.includes("csv") || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const furnitureTypes = [
  "Sofa",
  "Sectional Sofa",
  "Loveseat",
  "Armchair",
  "Dining Chair",
  "Office Chair",
  "Dining Table",
  "Coffee Table",
  "Side Table",
  "Bed",
  "Bedside Table",
  "Cabinet",
  "Media Console",
  "Bookshelf",
  "Desk",
  "Ottoman",
  "Bench",
  "Outdoor Furniture",
  "Other",
] as const;
const productStatuses = ["In Stock", "Low Stock", "Made to Order", "Out of Stock", "Draft"] as const;
const rooms = ["Living Room", "Dining Room", "Bedroom", "Home Office", "Entryway", "Outdoor", "Kids Room", "Multi-room"];
const upholsteryMaterials = ["None", "Performance Linen", "Linen Blend", "Bouclé", "Velvet", "Chenille", "Cotton Blend", "Microfiber", "Leather", "Faux Leather", "Solution-dyed Outdoor Fabric", "Other"];
const frameMaterials = ["Solid Oak", "Solid Ash", "Kiln-dried Hardwood", "Engineered Hardwood", "Plywood", "Powder-coated Steel", "Stainless Steel", "Aluminum", "Rattan / Cane", "Stone", "Other"];
const cushionFillings = ["None", "High-resilience Foam", "Foam & Feather Blend", "Pocket Spring & Foam", "Memory Foam", "Quick-dry Outdoor Foam", "Down Alternative", "Other"];
const finishes = ["Natural", "Oiled", "Matte", "Lacquered", "Painted", "Powder-coated", "Smoked", "Walnut Stain", "Upholstered", "Polished Stone", "Other"];

function productCsrf(req: import("express").Request) {
  const session = req.session as AdminSession & { productCsrf?: string };
  return session.productCsrf ||= randomBytes(32).toString("hex");
}

function productOptions() {
  return { furnitureTypes, productStatuses, rooms, upholsteryMaterials, frameMaterials, cushionFillings, finishes };
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseTagIds(value: unknown) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0);
}

function generateSku(furnitureType?: unknown, name?: unknown) {
  const source = String(furnitureType || name || "FUR")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const prefix = (source.slice(0, 3) || "FUR").padEnd(3, "X");
  return `KS-${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function parseImageUrls(body: Record<string, unknown>) {
  const submittedUrls = body.imageUrls;
  const rawUrls = submittedUrls !== undefined
    ? (Array.isArray(submittedUrls) ? submittedUrls : [submittedUrls])
    : [body.primaryImageUrl, body.secondaryImageUrl];
  const imageUrls = rawUrls
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (imageUrls.length === 0) throw new Error("At least one product image URL is required.");

  imageUrls.forEach((value, index) => {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw new Error(`Product image ${index + 1} must be a valid HTTP or HTTPS URL.`);
    }
  });

  return [...new Set(imageUrls)];
}

function productDataFromBody(body: Record<string, unknown>) {
  const requiredText = (key: string, label: string) => {
    const value = String(body[key] || "").trim();
    if (!value) throw new Error(`${label} is required.`);
    return value;
  };
  const requiredNumber = (key: string, label: string, minimum = 0) => {
    const value = optionalNumber(body[key]);
    if (value === null || Number.isNaN(value) || value < minimum) {
      throw new Error(`${label} must be ${minimum === 0 ? "zero or more" : `at least ${minimum}`}.`);
    }
    return value;
  };

  const categoryId = requiredNumber("categoryId", "Category", 1);
  const price = requiredNumber("price", "Price", 0.01);
  const stock = requiredNumber("stock", "Stock");
  const widthCm = requiredNumber("widthCm", "Width", 0.01);
  const depthCm = requiredNumber("depthCm", "Depth", 0.01);
  const heightCm = requiredNumber("heightCm", "Height", 0.01);
  const furnitureType = requiredText("furnitureType", "Furniture type");
  const room = requiredText("room", "Room");
  const status = requiredText("status", "Status");

  if (!Number.isSafeInteger(categoryId)) throw new Error("Choose a valid category.");
  if (!Number.isInteger(stock)) throw new Error("Stock must be a whole number.");
  if (!furnitureTypes.includes(furnitureType as typeof furnitureTypes[number])) throw new Error("Choose a valid furniture type.");
  if (!productStatuses.includes(status as typeof productStatuses[number])) throw new Error("Choose a valid status.");

  const imageUrls = parseImageUrls(body);

  const seatingCapacity = optionalNumber(body.seatingCapacity);
  const warrantyMonths = requiredNumber("warrantyMonths", "Warranty");
  const rating = optionalNumber(body.rating) ?? 0;
  const reviewCount = optionalNumber(body.reviewCount) ?? 0;
  if (Number.isNaN(seatingCapacity) || (seatingCapacity !== null && (!Number.isInteger(seatingCapacity) || seatingCapacity < 1))) throw new Error("Seating capacity must be a positive whole number.");
  if (!Number.isInteger(warrantyMonths)) throw new Error("Warranty must be a whole number of months.");
  if (Number.isNaN(rating) || rating < 0 || rating > 5) throw new Error("Rating must be between 0 and 5.");
  if (Number.isNaN(reviewCount) || !Number.isInteger(reviewCount) || reviewCount < 0) throw new Error("Review count must be a whole number.");

  const dimensions = String(body.dimensions || "").trim() || `W ${widthCm} × D ${depthCm} × H ${heightCm} cm`;
  const optionalFields = ["weightKg", "maxLoadKg", "seatHeightCm"] as const;
  const optionalValues = Object.fromEntries(optionalFields.map((key) => [key, optionalNumber(body[key])])) as Record<typeof optionalFields[number], number | null>;
  for (const [key, value] of Object.entries(optionalValues)) {
    if (Number.isNaN(value) || (value !== null && value < 0)) throw new Error(`${key.replace(/([A-Z])/g, " $1")} must be zero or more.`);
  }

  return {
    categoryId,
    sku: String(body.sku || "").trim().toUpperCase() || generateSku(body.furnitureType, body.name),
    name: requiredText("name", "Product name"),
    shortDescription: requiredText("shortDescription", "Short description"),
    brand: requiredText("brand", "Brand / collection"),
    price,
    stock,
    rating,
    reviewCount,
    primaryImageUrl: imageUrls[0],
    secondaryImageUrl: imageUrls[1] || null,
    images: imageUrls,
    description: requiredText("description", "Description"),
    status,
    isNewArrival: body.isNewArrival === "on",
    isBestSeller: body.isBestSeller === "on",
    colors: parseList(String(body.colors || "")),
    configurations: parseList(String(body.configurations || "Standard")),
    furnitureType,
    material: requiredText("material", "Material summary"),
    upholsteryMaterial: String(body.upholsteryMaterial || "").trim() || null,
    frameMaterial: String(body.frameMaterial || "").trim() || null,
    cushionFilling: String(body.cushionFilling || "").trim() || null,
    finish: String(body.finish || "").trim() || null,
    room,
    dimensions,
    widthCm,
    depthCm,
    heightCm,
    seatHeightCm: optionalValues.seatHeightCm,
    seatingCapacity,
    weightKg: optionalValues.weightKg,
    maxLoadKg: optionalValues.maxLoadKg,
    assemblyRequired: body.assemblyRequired === "on",
    warrantyMonths,
    careInstructions: String(body.careInstructions || "").trim() || null,
  };
}

async function productFormLookups() {
  return Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.tagGroup.findMany({ orderBy: { sortOrder: "asc" }, include: { tags: { orderBy: { sortOrder: "asc" } } } }),
  ]);
}

function productErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "That SKU is already used by another product.";
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// Login
router.get("/login", redirectIfLoggedIn, (req, res) => {
  renderAdmin(res, "login", {
    title: "Admin Login",
    error: req.query.error,
  });
});

router.post("/login", redirectIfLoggedIn, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== "ADMIN") {
      return res.redirect("/admin/login?error=Invalid+credentials");
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return res.redirect("/admin/login?error=Invalid+credentials");
    }

    const session = req.session as AdminSession;
    session.userId = user.id;
    session.role = user.role;
    session.name = user.name;

    res.redirect("/admin/products");
  } catch {
    res.redirect("/admin/login?error=Login+failed");
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

// Dashboard redirect
router.get("/", requireAdminPage, (_req, res) => {
  res.redirect("/admin/products");
});

const orderStatuses = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
function orderCsrf(req: import("express").Request) {
  const session = req.session as AdminSession & { orderCsrf?: string };
  return session.orderCsrf ||= randomBytes(32).toString("hex");
}

router.get("/orders", requireAdminPage, async (req, res) => {
  const search = String(req.query.search || "").trim().slice(0, 200);
  const status = orderStatuses.find(value => value === req.query.status);
  const page = Math.max(1, Math.min(100000, Math.floor(Number(req.query.page) || 1)));
  const where = { ...(status ? { status } : {}), ...(search ? { OR: [
    { orderNumber: { contains: search, mode: "insensitive" as const } },
    { customerName: { contains: search, mode: "insensitive" as const } },
    { customerEmail: { contains: search, mode: "insensitive" as const } },
  ] } : {}) };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20,
      select: { id: true, orderNumber: true, customerName: true, customerEmail: true, userId: true,
        paymentStatus: true, status: true, createdAt: true, total: true, trackingUrl: true } }),
    prisma.order.count({ where }),
  ]);
  renderAdmin(res, "orders", { title: "Orders", adminName: (req.session as AdminSession).name,
    orders, search, status: status || "", statuses: orderStatuses, total, page, totalPages: Math.ceil(total / 20) });
});

router.get("/orders/:id", requireAdminPage, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(404).send("Order not found");
  const order = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: { select: { name: true, primaryImageUrl: true } } } } } });
  if (!order) return res.status(404).send("Order not found");
  renderAdmin(res, "order-detail", { title: order.orderNumber, adminName: (req.session as AdminSession).name,
    order, statuses: orderStatuses, csrf: orderCsrf(req), saved: req.query.saved === "1",
    siteUrl: process.env.FRONTEND_URL || "https://khansofa.com" });
});

router.post("/orders/:id/tracking", requireAdminPage, async (req, res) => {
  if (!req.body.csrf || req.body.csrf !== orderCsrf(req)) return res.status(403).send("Please reload the order page and try again.");
  const id = Number(req.params.id);
  const status = orderStatuses.find(value => value === req.body.status);
  if (!Number.isSafeInteger(id) || id <= 0 || !status) return res.status(400).send("Invalid order or status");
  const trackingUrl = String(req.body.trackingUrl || "").trim();
  if (trackingUrl) {
    try {
      const url = new URL(trackingUrl);
      if (url.protocol !== "https:" || url.username || url.password || trackingUrl.length > 2048) throw new Error();
    } catch { return res.status(400).send("Enter a valid HTTPS courier tracking URL. Go back to correct it."); }
  }
  const order = await prisma.order.findUnique({ where: { id }, select: { paymentStatus: true } });
  if (!order) return res.status(404).send("Order not found");
  if (["SHIPPED", "DELIVERED"].includes(status) && order.paymentStatus !== "PAID") return res.status(400).send("Payment must be confirmed before marking an order shipped or delivered.");
  await prisma.order.update({ where: { id }, data: { trackingUrl: trackingUrl || null, status } });
  res.redirect(`/admin/orders/${id}?saved=1`);
});

// Products list
router.get("/products", requireAdminPage, async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const limit = 20;
  const search = String(req.query.search || "").trim().slice(0, 200);
  const categoryId = Number(req.query.categoryId) || 0;
  const status = productStatuses.find((value) => value === req.query.status) || "";
  const furnitureType = furnitureTypes.find((value) => value === req.query.furnitureType) || "";
  const skip = (page - 1) * limit;

  const where = {
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { brand: { contains: search, mode: "insensitive" as const } },
      { sku: { contains: search, mode: "insensitive" as const } },
    ] } : {}),
    ...(categoryId > 0 ? { categoryId } : {}),
    ...(status ? { status } : {}),
    ...(furnitureType ? { furnitureType } : {}),
  };

  try {
    const [products, total, categories, productCount, lowStockCount, outOfStockCount, draftCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { category: { select: { name: true } }, _count: { select: { orderItems: true } } },
      }),
      prisma.product.count({ where }),
      prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.product.count(),
      prisma.product.count({ where: { stock: { gt: 0, lte: 5 } } }),
      prisma.product.count({ where: { OR: [{ stock: 0 }, { status: "Out of Stock" }] } }),
      prisma.product.count({ where: { status: "Draft" } }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    renderAdmin(res, "products", {
      title: "Products",
      products: products.map((p) => ({
        ...p,
        price: Number(p.price),
        categoryName: p.category.name,
        canDelete: p._count.orderItems === 0,
      })),
      message: req.query.message,
      error: req.query.error,
      adminName: (req.session as AdminSession).name,
      search,
      categoryId,
      status,
      furnitureType,
      categories,
      furnitureTypes,
      productStatuses,
      stats: { productCount, lowStockCount, outOfStockCount, draftCount },
      csrf: productCsrf(req),
      page,
      totalPages,
      total,
    });
  } catch {
    renderAdmin(res, "products", {
      title: "Products",
      products: [],
      error: "Failed to load products",
      adminName: (req.session as AdminSession).name,
      search,
      categoryId,
      status,
      furnitureType,
      categories: [],
      furnitureTypes,
      productStatuses,
      stats: { productCount: 0, lowStockCount: 0, outOfStockCount: 0, draftCount: 0 },
      csrf: productCsrf(req),
      page: 1,
      totalPages: 1,
      total: 0,
    });
  }
});

// CSV import (must be before /products/:id routes)
router.get("/products/import", requireAdminPage, (req, res) => {
  renderAdmin(res, "import", {
    title: "Import CSV",
    message: req.query.message,
    error: req.query.error,
    adminName: (req.session as AdminSession).name,
  });
});

router.post(
  "/products/import",
  requireAdminPage,
  upload.single("csv"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.redirect("/admin/products/import?error=Please+select+a+CSV+file");
      }

      const csv = req.file.buffer.toString("utf-8");
      const replaceAll = req.body.replaceAll === "on";
      let clearedSummary = "";
      let result: Awaited<ReturnType<typeof importProductsFromCsv>>;

      if (replaceAll) {
        const freshResult = await importProductsFromCsvFresh(csv);
        clearedSummary = `Cleared ${freshResult.cleared.productsDeleted} products. `;
        result = freshResult;
      } else {
        result = await importProductsFromCsv(csv);
      }

      const msg = encodeURIComponent(
        clearedSummary +
          `Import done: ${result.created} created, ${result.updated} updated` +
          (result.errors.length ? `, ${result.errors.length} errors` : "")
      );
      res.redirect(`/admin/products?message=${msg}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      res.redirect(`/admin/products/import?error=${encodeURIComponent(message)}`);
    }
  }
);

// Add product form
router.get("/products/new", requireAdminPage, async (req, res) => {
  const [categories, tagGroups] = await productFormLookups();
  renderAdmin(res, "product-form", {
    title: "Add Product",
    product: null,
    categories,
    tagGroups,
    selectedTagIds: [],
    formValues: { sku: generateSku() },
    error: req.query.error,
    csrf: productCsrf(req),
    ...productOptions(),
    adminName: (req.session as AdminSession).name,
  });
});

// Create product
router.post("/products", requireAdminPage, async (req, res) => {
  if (!req.body.csrf || req.body.csrf !== productCsrf(req)) return res.status(403).send("Please reload the product form and try again.");
  try {
    const data = productDataFromBody(req.body);
    const tagIds = parseTagIds(req.body.tagIds);
    await prisma.product.create({
      data: {
        ...data,
        tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      },
    });
    res.redirect("/admin/products?message=Product+created");
  } catch (error) {
    const [categories, tagGroups] = await productFormLookups();
    res.status(400);
    renderAdmin(res, "product-form", {
      title: "Add Product",
      product: null,
      formValues: req.body,
      selectedTagIds: parseTagIds(req.body.tagIds),
      categories,
      tagGroups,
      error: productErrorMessage(error, "Failed to create product."),
      csrf: productCsrf(req),
      ...productOptions(),
      adminName: (req.session as AdminSession).name,
    });
  }
});

// Edit product form
router.get("/products/:id/edit", requireAdminPage, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.redirect("/admin/products?error=Product+not+found");
  const [[categories, tagGroups], product] = await Promise.all([
    productFormLookups(),
    prisma.product.findUnique({ where: { id }, include: { tags: { select: { id: true } } } }),
  ]);

  if (!product) {
    return res.redirect("/admin/products?error=Product+not+found");
  }

  renderAdmin(res, "product-form", {
    title: "Edit Product",
    product: {
      ...product,
      price: Number(product.price),
      widthCm: product.widthCm === null ? null : Number(product.widthCm),
      depthCm: product.depthCm === null ? null : Number(product.depthCm),
      heightCm: product.heightCm === null ? null : Number(product.heightCm),
      seatHeightCm: product.seatHeightCm === null ? null : Number(product.seatHeightCm),
      weightKg: product.weightKg === null ? null : Number(product.weightKg),
      maxLoadKg: product.maxLoadKg === null ? null : Number(product.maxLoadKg),
    },
    formValues: {},
    selectedTagIds: product.tags.map((tag) => tag.id),
    categories,
    tagGroups,
    error: req.query.error,
    csrf: productCsrf(req),
    ...productOptions(),
    adminName: (req.session as AdminSession).name,
  });
});

// Update product
router.post("/products/:id", requireAdminPage, async (req, res) => {
  const id = Number(req.params.id);
  if (!req.body.csrf || req.body.csrf !== productCsrf(req)) return res.status(403).send("Please reload the product form and try again.");
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(404).send("Product not found");
  try {
    const data = productDataFromBody(req.body);
    const tagIds = parseTagIds(req.body.tagIds);
    await prisma.product.update({
      where: { id },
      data: {
        ...data,
        tags: { set: tagIds.map((tagId) => ({ id: tagId })) },
      },
    });
    res.redirect("/admin/products?message=Product+updated");
  } catch (error) {
    const [categories, tagGroups] = await productFormLookups();
    res.status(400);
    renderAdmin(res, "product-form", {
      title: "Edit Product",
      product: { id },
      formValues: req.body,
      selectedTagIds: parseTagIds(req.body.tagIds),
      categories,
      tagGroups,
      error: productErrorMessage(error, "Failed to update product."),
      csrf: productCsrf(req),
      ...productOptions(),
      adminName: (req.session as AdminSession).name,
    });
  }
});

// Delete product
router.post("/products/:id/delete", requireAdminPage, async (req, res) => {
  const id = Number(req.params.id);
  if (!req.body.csrf || req.body.csrf !== productCsrf(req)) return res.status(403).send("Please reload the products page and try again.");
  if (!Number.isSafeInteger(id) || id <= 0) return res.redirect("/admin/products?error=Product+not+found");
  try {
    const orderItems = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItems > 0) {
      return res.redirect("/admin/products?error=This+product+belongs+to+an+order.+Mark+it+out+of+stock+instead.");
    }
    await prisma.product.delete({ where: { id } });
    res.redirect("/admin/products?message=Product+deleted");
  } catch {
    res.redirect("/admin/products?error=Could+not+delete+product");
  }
});

export default router;
