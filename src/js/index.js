import {
  getRegistryItems,
  claimGift,
  contributeToFund,
  listenToClaims,
  formatNaira,
} from "./sanity.js";

// ══════════════════════════════════════════
//  COUNTDOWN
// ══════════════════════════════════════════
function updateCountdown() {
  const target = new Date("2026-08-15T10:00:00");
  const now = new Date();
  const diff = target - now;
  const ids = ["cd-days", "cd-hours", "cd-mins", "cd-secs"];
  if (diff <= 0) {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "00";
    });
    return;
  }
  const vals = [
    Math.floor(diff / 86400000),
    Math.floor((diff % 86400000) / 3600000),
    Math.floor((diff % 3600000) / 60000),
    Math.floor((diff % 60000) / 1000),
  ];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const nv = String(vals[i]).padStart(i === 0 ? 3 : 2, "0");
    if (el.textContent !== nv) {
      el.textContent = nv;
      el.classList.remove("tick");
      void el.offsetWidth;
      el.classList.add("tick");
      setTimeout(() => el.classList.remove("tick"), 200);
    }
  });
}

// Initialize countdown when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  updateCountdown();
  setInterval(updateCountdown, 1000);
});

// ══════════════════════════════════════════
//  SCROLL REVEAL
// ══════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".timeline-item").forEach((el) => {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.15 },
    ).observe(el);
  });
});

// ══════════════════════════════════════════
//  GALLERY
// ══════════════════════════════════════════
const GALLERY = [
  { h: 280, e: "🌸" },
  { h: 200, e: "🌿" },
  { h: 240, e: "💍" },
  { h: 320, e: "🌅" },
  { h: 180, e: "🥂" },
  { h: 260, e: "🌺" },
  { h: 200, e: "💑" },
  { h: 280, e: "🕊️" },
  { h: 220, e: "🌾" },
];
const GRADS = [
  "linear-gradient(135deg,#f2d9d5,#e8d8c0)",
  "linear-gradient(135deg,#d4ddc5,#e8d8c0)",
  "linear-gradient(135deg,#e8d8c0,#f2d9d5)",
  "linear-gradient(135deg,#d4a5a0,#e8d8c0)",
  "linear-gradient(135deg,#a8b5a2,#d4ddc5)",
  "linear-gradient(135deg,#f4b8b0,#d4a5a0)",
  "linear-gradient(135deg,#e8d8c0,#a8b5a2)",
  "linear-gradient(135deg,#d4ddc5,#f2d9d5)",
  "linear-gradient(135deg,#f2d9d5,#e8d8c0)",
];
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
}
window.closeLightbox = closeLightbox;

document.addEventListener("DOMContentLoaded", () => {
  const gallGrid = document.getElementById("gallery-grid");
  if (gallGrid) {
    GALLERY.forEach((item, i) => {
      const d = document.createElement("div");
      d.className = "masonry-item";
      d.innerHTML = `<div class="gallery-placeholder" style="height:${item.h}px;background:${GRADS[i]};">${item.e}</div>`;
      d.addEventListener("click", () => {
        const lbc = document.getElementById("lb-content");
        lbc.style.background = GRADS[i];
        lbc.textContent = item.e;
        document.getElementById("lightbox").classList.add("open");
      });
      gallGrid.appendChild(d);
    });
  }
  const lightbox = document.getElementById("lightbox");
  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === this) closeLightbox();
    });
  }
});

// ══════════════════════════════════════════
//  REGISTRY — Sanity Backend
// ══════════════════════════════════════════

// type: 'claim'  → one person takes the whole item
// type: 'fund'   → multiple contributors, tracks toward a goal amount
// Note: Registry items are now stored in Sanity, this array is kept for reference
const REGISTRY_ITEMS_LEGACY = [
  {
    id: "r01",
    type: "claim",
    name: "Dinner Set (6 persons)",
    desc: "Ceramic, neutral tones — for every meal shared together",
  },
  {
    id: "r02",
    type: "claim",
    name: "Stand Mixer",
    desc: "For Sunday baking and all the sweet things ahead",
  },
  {
    id: "r03",
    type: "claim",
    name: "King Bed Linen Set",
    desc: "High-thread-count cotton, ivory or sage — rest well, love well",
  },
  {
    id: "r04",
    type: "claim",
    name: "Air Fryer",
    desc: "For quick weeknight dinners and weekend experiments",
  },
  {
    id: "r05",
    type: "claim",
    name: "Wall Art / Framed Prints",
    desc: "To fill our walls with beauty and meaning",
  },
  {
    id: "r06",
    type: "claim",
    name: "Blender & Smoothie Set",
    desc: "Because mornings together deserve a good start",
  },
  {
    id: "r08",
    type: "claim",
    name: "Throw Blanket",
    desc: "Soft, warm, and perfect for movie nights in",
  },
  {
    id: "r09",
    type: "claim",
    name: "Non-stick Cookware Set",
    desc: "Everything needed to cook with love every day",
  },
  {
    id: "r10",
    type: "claim",
    name: "Smart Home Speaker",
    desc: "Music fills every corner of a happy home",
  },
  {
    id: "r11",
    type: "claim",
    name: "Dining Table Runner & Placemats",
    desc: "To dress our table for every occasion",
  },
  {
    id: "r13",
    type: "claim",
    name: "Bathroom Towel Set (luxury)",
    desc: "Plush, thick towels — the little luxuries matter",
  },
  {
    id: "r14",
    type: "claim",
    name: "Indoor Plants & Planters",
    desc: "To bring life and greenery into our home",
  },
  {
    id: "r15",
    type: "claim",
    name: "Microwave Oven",
    desc: "A kitchen essential for every busy, happy home",
  },
  {
    id: "r16",
    type: "claim",
    name: "Ironing Board",
    desc: "For crisp mornings and well-pressed beginnings",
  },
  {
    id: "r17",
    type: "claim",
    name: "Baking Tools Set",
    desc: "Measuring spoons, spatulas, mixing bowls — for sweet adventures in the kitchen",
  },
  {
    id: "r18",
    type: "claim",
    name: "Air Conditioner (AC)",
    desc: "Cool comfort for our home through every warm season",
  },
  {
    id: "r19",
    type: "fund",
    name: "Chest Freezer",
    desc: "To keep our home well-stocked and running smoothly",
    goal: 500000,
  },
  {
    id: "r20",
    type: "fund",
    name: "House Paint",
    desc: "Colours and coats to make our house a beautiful home",
    goal: 600000,
  },
  {
    id: "r21",
    type: "fund",
    name: "Inverter & Battery System",
    desc: "Uninterrupted power for every moment at home",
    goal: 2000000,
  },
];

// Use Sanity's formatNaira function
function fmt(n) {
  return formatNaira(n);
}

function getContribTotal(contributions) {
  return (contributions || []).reduce((s, c) => s + Number(c.amount), 0);
}

async function renderRegistry() {
  const list = document.getElementById("registry-list");
  if (!list) return;

  // Show loading state
  list.innerHTML =
    '<div style="text-align:center;padding:2rem;color:var(--text-light);font-style:italic;">Loading registry...</div>';

  try {
    // Fetch items from Sanity
    const items = await getRegistryItems();

    // Separate into regular and fund items
    const regular = items.filter((i) => i.type === "claim");
    const funds = items.filter((i) => i.type === "fund");

    let html = "";

    // ── Regular items ──────────────────────────────
    regular.forEach((item) => {
      const fullClaim = item.claims?.find((c) => c.claimType === "claim");
      const taken = !!fullClaim;
      const safeName = item.name.replace(/'/g, "&#39;");
      html += `<div class="registry-item" id="row-${item.itemId}">
        <div class="registry-item-info">
          <div class="registry-item-name" style="${taken ? "opacity:.45;text-decoration:line-through;" : ""}">${item.name}</div>
          <div class="registry-item-desc">${item.description}</div>
          ${taken ? `<div class="claimed-by">Claimed by ${fullClaim.guestName}</div>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem;flex-shrink:0;min-width:90px;">
          <div class="registry-item-status ${taken ? "taken" : "available"}">${taken ? "Claimed" : "Available"}</div>
          ${!taken ? `<button class="claim-btn" onclick="openClaim('${item.itemId}','${safeName}')">I'll gift this</button>` : ""}
        </div>
      </div>`;
    });

    // ── Fund / contribution items ──────────────────
    if (funds.length) {
      html += `<div style="margin-top:2rem;margin-bottom:.5rem;">
        <div style="font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;color:var(--sage-dark);text-align:center;padding:.6rem 0;border-top:1px solid rgba(212,165,160,0.2);border-bottom:1px solid rgba(212,165,160,0.2);margin-bottom:1.5rem;">
          Community Contributions — Help Us Reach the Goal
        </div>`;

      funds.forEach((item) => {
        const contribs =
          item.claims?.filter((c) => c.claimType === "contribution") || [];
        const raised = item.totalRaised || 0;
        const pct = Math.min(100, Math.round((raised / item.goal) * 100));
        const full = raised >= item.goal;
        const safeName = item.name.replace(/'/g, "&#39;");

        html += `<div class="registry-item" id="row-${item.itemId}" style="flex-direction:column;align-items:stretch;gap:.8rem;padding:1.2rem 0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
            <div class="registry-item-info" style="flex:1;">
              <div class="registry-item-name">${item.name} <span class="registry-item-tag">Contribution</span></div>
              <div class="registry-item-desc">${item.description}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:var(--text);">${fmt(item.goal)}</div>
            <div style="font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-light);">Goal</div>
          </div>
        </div>
        <div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
          <div class="progress-label">
            <span class="raised">${fmt(raised)} raised</span>
            <span>${pct}% of ${fmt(item.goal)}</span>
          </div>
        </div>
        ${
          contribs.length > 0
            ? `<div class="contributors-list">
          ${contribs.map((c) => `<div class="contributor-entry">✦ <span>${c.guestName}</span> contributed ${fmt(c.amount)}</div>`).join("")}
        </div>`
            : ""
        }
        <div style="text-align:right;">
            ${
              full
                ? `<div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--olive);">Goal reached — thank you! 🌸</div>`
                : `<button class="claim-btn" onclick="openContrib('${item.itemId}','${safeName}',${item.goal})">Contribute</button>`
            }
          </div>
        </div>`;
      });

      html += `</div>`;
    }

    list.innerHTML = html;
  } catch (error) {
    console.error("Failed to load registry:", error);
    list.innerHTML =
      '<div style="text-align:center;padding:2rem;color:var(--deep-rose);">Failed to load registry. Please refresh the page.</div>';
  }
}

let _claimId = null;
let _claimItemName = null;
let _claimType = "claim"; // 'claim' or 'fund'
let _claimGoal = 0;

function openRegistryModal() {
  renderRegistry();
  document.getElementById("registry-modal").classList.add("open");
}

// Expose functions globally for inline onclick handlers
window.openRegistryModal = openRegistryModal;

function openClaim(itemId, itemName) {
  _claimId = itemId;
  _claimItemName = itemName;
  _claimType = "claim";
  document.getElementById("claim-item-title").textContent = itemName;
  document.getElementById("claim-modal-body").innerHTML = `
    <div style="padding:2rem;">
      <p style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:1rem;color:var(--text-light);margin-bottom:1.5rem;line-height:1.7;">So kind of you! Please leave your name so the couple knows who to thank. 🌸</p>
      <div class="rsvp-field">
        <label class="rsvp-label">Your Name <span style="color:var(--deep-rose)">*</span></label>
        <input class="rsvp-input" type="text" id="claimer-name" placeholder="e.g. Auntie Bisi" />
      </div>
      <div class="rsvp-field">
        <label class="rsvp-label">Your Email</label>
        <input class="rsvp-input" type="email" id="claimer-email" placeholder="e.g. auntie@example.com" />
        <p style="font-size:.72rem;color:var(--text-light);margin-top:.4rem;">Optional — for confirmation</p>
      </div>
      <button class="btn" style="width:100%;margin-top:.5rem;" onclick="confirmClaim(this)">Confirm — I'll get this gift ✦</button>
    </div>`;
  document.getElementById("claim-modal").classList.add("open");
}

async function openContrib(itemId, itemName, goal) {
  _claimId = itemId;
  _claimItemName = itemName;
  _claimType = "fund";
  _claimGoal = goal;

  // Fetch current data from Sanity
  const items = await getRegistryItems();
  const item = items.find((i) => i.itemId === itemId);
  const raised = item?.totalRaised || 0;
  const remaining = goal - raised;

  document.getElementById("claim-item-title").textContent =
    "Contribute to " + itemName;
  document.getElementById("claim-modal-body").innerHTML = `
    <div style="padding:2rem;">
      <p style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:1rem;color:var(--text-light);margin-bottom:.8rem;line-height:1.7;">Your contribution brings us closer to home — thank you from the bottom of our hearts. 🌸</p>
      <div style="background:rgba(107,124,82,0.06);border-radius:4px;padding:.9rem 1rem;margin-bottom:1.4rem;font-size:.82rem;color:var(--text-light);">
        Goal: <strong style="color:var(--text)">${fmt(goal)}</strong> &nbsp;·&nbsp;
        Raised: <strong style="color:var(--olive)">${fmt(raised)}</strong> &nbsp;·&nbsp;
        Remaining: <strong style="color:var(--deep-rose)">${fmt(remaining)}</strong>
      </div>
      <div class="rsvp-field">
        <label class="rsvp-label">Your Name <span style="color:var(--deep-rose)">*</span></label>
        <input class="rsvp-input" type="text" id="claimer-name" placeholder="e.g. Uncle Tunde" />
      </div>
      <div class="rsvp-field">
        <label class="rsvp-label">Your Email</label>
        <input class="rsvp-input" type="email" id="claimer-email" placeholder="e.g. uncle@example.com" />
        <p style="font-size:.72rem;color:var(--text-light);margin-top:.4rem;">Optional — for confirmation</p>
      </div>
      <div class="rsvp-field">
        <label class="rsvp-label">Contribution Amount (₦) <span style="color:var(--deep-rose)">*</span></label>
        <input class="rsvp-input" type="number" id="contrib-amount" placeholder="e.g. 50000" min="1000" max="${remaining}" />
        <p style="font-size:.72rem;color:var(--text-light);margin-top:.4rem;">Maximum remaining: ${fmt(remaining)}</p>
      </div>
      <button class="btn btn-olive" style="width:100%;margin-top:.5rem;" onclick="confirmContrib(this)">Confirm Contribution ✦</button>
    </div>`;
  document.getElementById("claim-modal").classList.add("open");
}

async function confirmClaim(btn) {
  const name = document.getElementById("claimer-name").value.trim();
  const email = document.getElementById("claimer-email").value.trim();

  if (!name) {
    document.getElementById("claimer-name").focus();
    return;
  }

  // Disable button and show loading
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Claiming...";

  try {
    await claimGift(_claimId, name, email);
    document.getElementById("claim-modal").classList.remove("open");
    await renderRegistry();

    // Show success message
    alert(`Thank you, ${name}! Your claim has been recorded. 🌸`);
  } catch (error) {
    console.error("Claim failed:", error);
    alert(error.message || "Failed to claim item. Please try again.");
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function confirmContrib(btn) {
  const name = document.getElementById("claimer-name").value.trim();
  const email = document.getElementById("claimer-email").value.trim();
  const amount = parseFloat(document.getElementById("contrib-amount").value);

  if (!name) {
    document.getElementById("claimer-name").focus();
    return;
  }
  if (!amount || amount < 1) {
    document.getElementById("contrib-amount").focus();
    return;
  }

  // Disable button and show loading
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Processing...";

  try {
    const result = await contributeToFund(_claimId, name, email, amount);
    const cappedAmount = result.amount;

    // Close claim modal, update registry
    document.getElementById("claim-modal").classList.remove("open");
    await renderRegistry();

    // Show cash modal immediately so guest can send the money
    const cashModal = document.getElementById("cash-modal");
    // Inject a personalised banner into cash modal
    const banner = document.getElementById("cash-contrib-banner");
    if (banner) {
      banner.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(107,124,82,0.1),rgba(242,217,213,0.2));border-radius:4px;padding:1rem 1.2rem;margin-bottom:1.5rem;border-left:3px solid var(--olive);text-align:left;">
          <div style="font-family:'Cormorant Garamond',serif;font-size:1rem;color:var(--text);margin-bottom:.2rem;">Thank you, <strong>${name}</strong>! 🌸</div>
          <div style="font-size:.82rem;color:var(--text-light);line-height:1.6;">Please send <strong style="color:var(--olive)">${fmt(cappedAmount)}</strong> toward the <strong>${_claimItemName}</strong> using the details below.</div>
        </div>`;
    }
    cashModal.classList.add("open");
  } catch (error) {
    console.error("Contribution failed:", error);
    alert(error.message || "Failed to record contribution. Please try again.");
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Expose all registry functions globally for inline onclick handlers
window.openClaim = openClaim;
window.openContrib = openContrib;
window.confirmClaim = confirmClaim;
window.confirmContrib = confirmContrib;

// Pre-render on load
window.addEventListener("load", renderRegistry);

// Set up real-time updates listener
let realtimeSubscription = null;
window.addEventListener("load", () => {
  realtimeSubscription = listenToClaims((update) => {
    // When a claim is added/updated, refresh the registry
    console.log("Registry updated in real-time:", update);
    renderRegistry();
  });
});

// Clean up subscription when page unloads
window.addEventListener("beforeunload", () => {
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
  }
});

// ══════════════════════════════════════════
//  RSVP SUBMIT
// ══════════════════════════════════════════
window.submitRSVP = submitRSVP;
function submitRSVP(btn) {
  const name = document.getElementById("rsvp-name").value.trim();
  const email = document.getElementById("rsvp-email").value.trim();
  const phone = document.getElementById("rsvp-phone").value.trim();
  const attending =
    document.querySelector('input[name="attendance"]:checked')?.value || "";
  const events = [
    ...document.querySelectorAll('input[name="event"]:checked'),
  ].map((el) => el.value);
  const message = document.getElementById("rsvp-message").value.trim();

  if (!name || !email || !attending) {
    const missing = [];
    if (!name) missing.push("Full Name");
    if (!email) missing.push("Email");
    if (!attending) missing.push("Attendance");
    btn.textContent = "Please fill in: " + missing.join(", ");
    setTimeout(() => (btn.textContent = "Send My RSVP ✦"), 2500);
    return;
  }

  // Save locally
  const rsvps = JSON.parse(localStorage.getItem("sa_rsvps_v1") || "[]");
  rsvps.push({
    name,
    email,
    phone,
    attending,
    events,
    message,
    at: new Date().toISOString(),
  });
  localStorage.setItem("sa_rsvps_v1", JSON.stringify(rsvps));

  const body = document.getElementById("rsvp-modal-body");
  body.innerHTML = `
    <div style="padding:4rem 2rem;text-align:center;">
      <div style="font-size:3rem;margin-bottom:1.2rem;animation:heartbeat 1.2s ease-in-out infinite;">💌</div>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:300;color:var(--text);margin-bottom:1rem;">Thank You, ${name.split(" ")[0]}!</h3>
      <p style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:1.15rem;color:var(--deep-rose);margin-bottom:1rem;">"We can't wait to celebrate with you."</p>
      <p style="font-size:.88rem;color:var(--text-light);line-height:1.8;">Your RSVP has been received. See you on <strong>August 15, 2026</strong>! 🌸</p>
    </div>`;
}

// ══════════════════════════════════════════
//  MODAL CLOSE ON OUTSIDE CLICK
// ══════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  ["rsvp-modal", "registry-modal", "claim-modal"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener("click", function (e) {
        if (e.target === this) this.classList.remove("open");
      });
  });
  // Cash modal — also clear banner on outside click
  const cashModalEl = document.getElementById("cash-modal");
  if (cashModalEl) {
    cashModalEl.addEventListener("click", function (e) {
      if (e.target === this) {
        this.classList.remove("open");
        const b = document.getElementById("cash-contrib-banner");
        if (b) b.innerHTML = "";
      }
    });
  }
  // Also clear banner when cash modal close button is used
  const cashClose = document.querySelector("#cash-modal .modal-close");
  if (cashClose) {
    cashClose.addEventListener("click", function () {
      const b = document.getElementById("cash-contrib-banner");
      if (b) b.innerHTML = "";
    });
  }

  // Parallax
  window.addEventListener("scroll", function () {
    var s = window.scrollY;
    if (s < window.innerHeight) {
      const hero = document.getElementById("hero");
      if (hero) hero.style.backgroundPositionY = s * 0.3 + "px";
    }
  });
});
