import { createClient } from "@sanity/client";

// CDN client for public reads (CORS-friendly)
export const client = createClient({
  projectId: "al7hyz6y",
  dataset: "production",
  useCdn: true,
  apiVersion: "2024-01-01",
});

// Write client for mutations and real-time (only when token is available)
export const writeClient = createClient({
  projectId: "al7hyz6y",
  dataset: "production",
  useCdn: false, // Real-time updates require useCdn: false
  apiVersion: "2024-01-01",
  token: import.meta.env.VITE_SANITY_TOKEN || "",
});

// Fetch all registry items with their claims
export async function getRegistryItems(fresh = false) {
  const fetchClient = fresh ? writeClient : client;
  const query = `*[_type == "registryItem"] | order(itemId) {
    _id,
    itemId,
    name,
    description,
    type,
    goal,
    "claims": *[_type == "claim" && references(^._id)] {
      _id,
      guestName,
      guestEmail,
      amount,
      claimType,
      claimedAt,
      status
    }
  }`;

  const items = await fetchClient.fetch(query);

  // Calculate totalRaised on the frontend since GROQ doesn't support sum()
  return items.map((item) => ({
    ...item,
    totalRaised: (item.claims || [])
      .filter((c) => c.claimType === "contribution")
      .reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
  }));
}

// Claim a gift (full claim)
export async function claimGift(itemId, guestName, guestEmail) {
  // First, find the registry item
  const item = await client.fetch(
    `*[_type == "registryItem" && itemId == $itemId][0]`,
    { itemId },
  );

  if (!item) throw new Error("Item not found");

  // Check if already claimed — use writeClient (no CDN cache) for fresh data
  const existingClaim = await writeClient.fetch(
    `*[_type == "claim" && references($itemRef) && claimType == "claim"][0]`,
    { itemRef: item._id },
  );

  if (existingClaim) {
    throw new Error("This item has already been claimed");
  }

  // Create claim using write client
  return await writeClient.create({
    _type: "claim",
    item: { _type: "reference", _ref: item._id },
    guestName,
    guestEmail: guestEmail || "",
    claimType: "claim",
    claimedAt: new Date().toISOString(),
    status: "pending",
  });
}

// Contribute to a fund item
export async function contributeToFund(itemId, guestName, guestEmail, amount) {
  const item = await client.fetch(
    `*[_type == "registryItem" && itemId == $itemId][0] {
      ...,
      "contributions": *[_type == "claim" && references(^._id) && claimType == "contribution"] { amount }
    }`,
    { itemId },
  );

  if (!item) throw new Error("Item not found");
  if (item.type !== "fund") throw new Error("This item is not a fund item");

  const totalRaised = (item.contributions || []).reduce(
    (acc, c) => acc + (Number(c.amount) || 0),
    0,
  );
  const remaining = item.goal - totalRaised;
  const cappedAmount = Math.min(amount, remaining);

  if (cappedAmount <= 0) {
    throw new Error("Goal already reached");
  }

  return await writeClient.create({
    _type: "claim",
    item: { _type: "reference", _ref: item._id },
    guestName,
    guestEmail: guestEmail || "",
    claimType: "contribution",
    amount: cappedAmount,
    claimedAt: new Date().toISOString(),
    status: "pending",
  });
}

// Real-time listener for claims
export function listenToClaims(callback) {
  const query = '*[_type == "claim"]';
  const subscription = writeClient.listen(query).subscribe((update) => {
    console.log("Real-time update received:", update);
    callback(update);
  });

  return subscription; // Return so it can be unsubscribed later
}

// Format currency
export function formatNaira(amount) {
  return "₦" + Number(amount).toLocaleString("en-NG");
}
