import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "al7hyz6y",
  dataset: "production",
  useCdn: false,
  token: process.env.SANITY_AUTH_TOKEN,
  apiVersion: "2024-01-01",
});

const items = [
  {
    _type: "registryItem",
    itemId: "r01",
    name: "Dinner Set (6 persons)",
    description: "Ceramic, neutral tones — for every meal shared together",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r02",
    name: "Stand Mixer",
    description: "For Sunday baking and all the sweet things ahead",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r03",
    name: "King Bed Linen Set",
    description:
      "High-thread-count cotton, ivory or sage — rest well, love well",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r04",
    name: "Air Fryer",
    description: "For quick weeknight dinners and weekend experiments",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r05",
    name: "Wall Art / Framed Prints",
    description: "To fill our walls with beauty and meaning",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r06",
    name: "Blender & Smoothie Set",
    description: "Because mornings together deserve a good start",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r08",
    name: "Throw Blanket",
    description: "Soft, warm, and perfect for movie nights in",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r09",
    name: "Non-stick Cookware Set",
    description: "Everything needed to cook with love every day",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r10",
    name: "Smart Home Speaker",
    description: "Music fills every corner of a happy home",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r11",
    name: "Dining Table Runner & Placemats",
    description: "To dress our table for every occasion",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r13",
    name: "Bathroom Towel Set (luxury)",
    description: "Plush, thick towels — the little luxuries matter",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r14",
    name: "Indoor Plants & Planters",
    description: "To bring life and greenery into our home",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r15",
    name: "Microwave Oven",
    description: "A kitchen essential for every busy, happy home",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r16",
    name: "Ironing Board",
    description: "For crisp mornings and well-pressed beginnings",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r17",
    name: "Baking Tools Set",
    description:
      "Measuring spoons, spatulas, mixing bowls — for sweet adventures in the kitchen",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r18",
    name: "Air Conditioner (AC)",
    description: "Cool comfort for our home through every warm season",
    type: "claim",
  },
  {
    _type: "registryItem",
    itemId: "r19",
    name: "Chest Freezer",
    description: "To keep our home well-stocked and running smoothly",
    type: "fund",
    goal: 500000,
  },
  {
    _type: "registryItem",
    itemId: "r20",
    name: "House Paint",
    description: "Colours and coats to make our house a beautiful home",
    type: "fund",
    goal: 600000,
  },
  {
    _type: "registryItem",
    itemId: "r21",
    name: "Inverter & Battery System",
    description: "Uninterrupted power for every moment at home",
    type: "fund",
    goal: 2000000,
  },
];

const transaction = client.transaction();
items.forEach((item) => transaction.create(item));

transaction
  .commit()
  .then(() => {
    console.log("✅ Successfully seeded", items.length, "registry items!");
    console.log("🎉 Your registry is ready!");
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  });
