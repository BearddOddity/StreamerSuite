import { db } from "./db.js";

const insertTool = db.prepare(`
  INSERT INTO tools (name, description, status, is_mvp, notes)
  VALUES (@name, @description, @status, @is_mvp, @notes)
  ON CONFLICT(name) DO UPDATE SET
    description = excluded.description,
    status = excluded.status,
    is_mvp = excluded.is_mvp,
    notes = excluded.notes,
    updated_at = datetime('now')
`);

const insertPlatform = db.prepare(`
  INSERT INTO platforms (name, integration_status, notes)
  VALUES (@name, @integration_status, @notes)
  ON CONFLICT(name) DO UPDATE SET
    integration_status = excluded.integration_status,
    notes = excluded.notes,
    updated_at = datetime('now')
`);

const insertTimeline = db.prepare(`
  INSERT INTO timeline (milestone, target, status, tool_id, notes)
  VALUES (@milestone, @target, @status, @tool_id, @notes)
`);

const insertDecision = db.prepare(`
  INSERT INTO decisions (title, description, rationale, tool_id)
  VALUES (@title, @description, @rationale, @tool_id)
`);

const seed = db.transaction(() => {
  insertTool.run({
    name: "Chat Manager",
    description: "Aggregated chat, moderation, filtering, and auto-responses across all 5 platforms. The MVP.",
    status: "in progress",
    is_mvp: 1,
    notes: "Alpha target: < 1 week. Beta target: 1 month.",
  });
  insertTool.run({
    name: "Status Forge",
    description: "Game detection + rich presence + metadata publishing to streaming platforms.",
    status: "planning",
    is_mvp: 0,
    notes: "Extract as a standalone Rust crate. Second tool, built after Chat Manager MVP.",
  });
  insertTool.run({
    name: "Overlays",
    description: "Unified overlay system for chat, alerts, and stream widgets.",
    status: "planning",
    is_mvp: 0,
    notes: "Post-MVP.",
  });
  insertTool.run({
    name: "Analytics",
    description: "Cross-platform streaming analytics and reporting.",
    status: "planning",
    is_mvp: 0,
    notes: "Post-MVP.",
  });
  insertTool.run({
    name: "Community Management",
    description: "Cross-platform community/follower management tools.",
    status: "planning",
    is_mvp: 0,
    notes: "Post-MVP.",
  });

  const platforms = ["Twitch", "Kick", "YouTube", "JoystickTV", "Rumble"];
  for (const name of platforms) {
    insertPlatform.run({
      name,
      integration_status: "not started",
      notes: "Chat aggregation + moderation API scoped for MVP.",
    });
  }

  const chatManagerId = (db.prepare("SELECT id FROM tools WHERE name = ?").get("Chat Manager") as { id: number }).id;
  const statusForgeId = (db.prepare("SELECT id FROM tools WHERE name = ?").get("Status Forge") as { id: number }).id;

  insertTimeline.run({
    milestone: "Alpha",
    target: "< 1 week",
    status: "planned",
    tool_id: chatManagerId,
    notes: "Chat Manager MVP alpha across all 5 platforms.",
  });
  insertTimeline.run({
    milestone: "Beta",
    target: "1 month",
    status: "planned",
    tool_id: chatManagerId,
    notes: "Chat Manager beta.",
  });
  insertTimeline.run({
    milestone: "Status Forge extraction",
    target: "post-MVP",
    status: "planned",
    tool_id: statusForgeId,
    notes: "Extract as standalone Rust crate after Chat Manager beta.",
  });

  insertDecision.run({
    title: "Rust backend + React frontend",
    description: "StreamerSuite is built with a Rust backend and a React frontend (Tauri app).",
    rationale: "Performance and safety for the backend, familiar and fast-to-iterate UI in React.",
    tool_id: null,
  });
  insertDecision.run({
    title: "Chat Manager as MVP",
    description: "Aggregate chat, moderation, filtering, and auto-responses across Twitch/Kick/YouTube/JoystickTV/Rumble is the first shippable tool.",
    rationale: "Chat management is the highest-value, most universally needed feature across all supported platforms.",
    tool_id: chatManagerId,
  });
  insertDecision.run({
    title: "Donation-based, open-source at launch",
    description: "StreamerSuite will be funded by donations and open-sourced once launched; repo is private until then.",
    rationale: "Keep the project accessible to the community while it's a solo build, open to contributors post-launch.",
    tool_id: null,
  });
  insertDecision.run({
    title: "Status Forge extracted as a Rust crate",
    description: "Game detection + rich presence + metadata publishing will live in its own reusable Rust crate.",
    rationale: "Decouples it from StreamerSuite so it can be reused or published independently.",
    tool_id: statusForgeId,
  });
});

seed();

console.log("Seed complete.");
