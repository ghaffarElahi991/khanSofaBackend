import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import {
  importProductsFromCsv,
  importProductsFromCsvFresh,
} from "../src/lib/import-products";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const fresh = args.includes("--fresh");
const filePath = args.find((arg) => !arg.startsWith("-"));

if (!filePath) {
  console.error("Usage: npm run db:import -- [--fresh] path/to/products.csv");
  process.exit(1);
}

const absolute = path.resolve(filePath);
const csv = readFileSync(absolute, "utf-8");

const run = fresh ? importProductsFromCsvFresh(csv) : importProductsFromCsv(csv);

run
  .then((result) => {
    if ("cleared" in result) {
      console.log(
        `Cleared: ${result.cleared.productsDeleted} products, ${result.cleared.ordersDeleted} orders, ${result.cleared.reviewsDeleted} reviews`
      );
    }
    console.log(`Parsed: ${result.total} products`);
    console.log(`Created: ${result.created}`);
    console.log(`Updated: ${result.updated}`);
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.length}`);
      result.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
      if (result.errors.length > 20) {
        console.log(`  ... and ${result.errors.length - 20} more`);
      }
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
