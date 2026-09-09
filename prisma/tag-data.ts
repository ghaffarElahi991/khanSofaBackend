export const tagGroupsData = [
  {
    name: "Rooms",
    slug: "rooms",
    sortOrder: 1,
    tags: ["Living Room", "Dining Room", "Bedroom", "Home Office", "Outdoor"],
  },
  {
    name: "Furniture Types",
    slug: "furniture-types",
    sortOrder: 2,
    tags: [
      "Sofas & Sectionals",
      "Accent Chairs",
      "Dining Tables",
      "Dining Chairs",
      "Beds",
      "Coffee & Side Tables",
      "Storage Furniture",
      "Outdoor Furniture",
    ],
  },
  {
    name: "Materials",
    slug: "materials",
    sortOrder: 3,
    tags: ["Solid Wood", "Performance Fabric", "Bouclé", "Leather", "Marble", "Rattan"],
  },
  {
    name: "Styles",
    slug: "styles",
    sortOrder: 4,
    tags: ["Contemporary", "Mid-century", "Minimal", "Classic", "Organic Modern"],
  },
  {
    name: "Collections",
    slug: "collections",
    sortOrder: 5,
    tags: ["New Arrivals", "Best Sellers", "Small Space", "Statement Pieces"],
  },
];

/** Top-level navigation. tagName links to /shop?tag=<slug>. */
export const navTreeData = [
  { label: "Home", href: "/", sortOrder: 1 },
  { label: "Living", tagName: "Living Room", sortOrder: 2 },
  { label: "Dining", tagName: "Dining Room", sortOrder: 3 },
  { label: "Bedroom", tagName: "Bedroom", sortOrder: 4 },
  { label: "Storage", tagName: "Storage Furniture", sortOrder: 5 },
  { label: "Outdoor", tagName: "Outdoor Furniture", sortOrder: 6 },
  { label: "New Arrivals", tagName: "New Arrivals", sortOrder: 7 },
  { label: "Shop", href: "/shop", sortOrder: 8 },
  { label: "About", href: "/about", sortOrder: 9 },
  { label: "Contact", href: "/contact", sortOrder: 10 },
];

export function slugifyTag(name: string) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/\/+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
