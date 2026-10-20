import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const seedPath = join(
  root,
  "..",
  "backend",
  "db",
  "seeds",
  "001_seed_products.sql",
);
const publicPath = join(root, "public");
const seed = readFileSync(seedPath, "utf8");

const imagePaths = [...seed.matchAll(/'(\/products\/[^']+\.webp)'/g)].map(
  (match) => match[1],
);

describe("Product catalog images", () => {
  it("defines exactly 30 product images in the seed", () => {
    expect(imagePaths).toHaveLength(30);
  });

  it("uses a unique image path for every product", () => {
    expect(new Set(imagePaths).size).toBe(30);
  });

  it("stores images in the correct category folders", () => {
    const categories = new Set([
      "accessories",
      "clothing",
      "food",
      "home",
      "skincare",
      "technology",
      "toys",
      "travel",
    ]);

    for (const imagePath of imagePaths) {
      const category = imagePath.split("/")[2];
      expect(categories.has(category), `Invalid category in ${imagePath}`).toBe(
        true,
      );
    }
  });

  it("has a real file for every image path", () => {
    for (const imagePath of imagePaths) {
      const fullPath = join(publicPath, imagePath.slice(1));
      expect(existsSync(fullPath), `Missing image: ${imagePath}`).toBe(true);
    }
  });
});
