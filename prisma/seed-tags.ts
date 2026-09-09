import { PrismaClient } from "../generated/prisma/client";
import { navTreeData, slugifyTag, tagGroupsData } from "./tag-data";

export async function seedTagsAndNav(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe('DELETE FROM "_ProductToTag"');
  await prisma.navItem.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.tagGroup.deleteMany();

  const tagByName = new Map<string, { id: number; slug: string }>();
  const tagsByGroupSlug = new Map<string, Array<{ id: number; name: string; slug: string }>>();

  for (const group of tagGroupsData) {
    const createdGroup = await prisma.tagGroup.create({
      data: { name: group.name, slug: group.slug, sortOrder: group.sortOrder },
    });

    const groupTags: Array<{ id: number; name: string; slug: string }> = [];

    for (let i = 0; i < group.tags.length; i++) {
      const name = group.tags[i];
      const existing = await prisma.tag.findUnique({ where: { name } });

      const tag = existing
        ? existing
        : await prisma.tag.create({
            data: {
              name,
              slug: slugifyTag(name),
              groupId: createdGroup.id,
              sortOrder: i + 1,
            },
          });

      tagByName.set(name.toLowerCase(), { id: tag.id, slug: tag.slug });
      groupTags.push({ id: tag.id, name: tag.name, slug: tag.slug });
    }

    tagsByGroupSlug.set(group.slug, groupTags);
  }

  async function createNavItem(
    item: (typeof navTreeData)[number],
    parentId?: number
  ) {
    let tagId: number | undefined;

    if ("tagName" in item && item.tagName) {
      tagId = tagByName.get(item.tagName.toLowerCase())?.id;
    }

    const nav = await prisma.navItem.create({
      data: {
        label: item.label,
        href: "href" in item ? item.href : null,
        tagId: tagId ?? null,
        parentId: parentId ?? null,
        sortOrder: item.sortOrder,
      },
    });

    if ("children" in item && item.children) {
      for (const child of item.children) {
        if ("groupSlug" in child && child.groupSlug) {
          const section = await prisma.navItem.create({
            data: {
              label: child.label,
              parentId: nav.id,
              sortOrder: 0,
              href: null,
            },
          });

          const tags = tagsByGroupSlug.get(child.groupSlug) || [];
          for (let i = 0; i < tags.length; i++) {
            await prisma.navItem.create({
              data: {
                label: tags[i].name,
                tagId: tags[i].id,
                parentId: section.id,
                sortOrder: i + 1,
              },
            });
          }
        }
      }
    }
  }

  for (const item of navTreeData) {
    await createNavItem(item);
  }

  console.log(`Seeded ${tagByName.size} tags and navigation menu`);
  return tagByName;
}

export async function connectProductTags(
  prisma: PrismaClient,
  productId: number,
  tagNames: string[],
  tagByName?: Map<string, { id: number; slug: string }>
) {
  const map =
    tagByName ||
    new Map(
      (await prisma.tag.findMany()).map((t) => [
        t.name.toLowerCase(),
        { id: t.id, slug: t.slug },
      ])
    );

  const tagIds: number[] = [];
  for (const name of tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const found = map.get(trimmed.toLowerCase());
    if (found) tagIds.push(found.id);
  }

  if (tagIds.length === 0) return;

  await prisma.product.update({
    where: { id: productId },
    data: {
      tags: { set: tagIds.map((id) => ({ id })) },
    },
  });
}
