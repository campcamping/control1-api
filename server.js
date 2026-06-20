const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

// =====================
// SUPABASE
// =====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =====================
// CONFIG
// =====================
const PORT = process.env.PORT || 3000;

// =====================
// HEALTH CHECK
// =====================
app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

// ======================================================
// ZONES
// ======================================================

// GET ALL ZONES
app.get("/api/zones", async (req, res) => {
  const { game_id } = req.query;

  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .eq("game_id", game_id);

  if (error) return res.status(500).json({ error });

  res.json(data);
});

// CREATE ZONE
app.post("/api/zone/create", async (req, res) => {
  const { game_id, name } = req.body;

  if (!game_id || !name) {
    return res.status(400).json({ error: "game_id and name required" });
  }

  // auto-generate clean zone_code
  const zone_code = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-");

  const { data, error } = await supabase
    .from("zones")
    .insert([
      {
        game_id,
        name,
        zone_code,
        master_volume: 50,
        muted: false,
        current_asset_id: null,
        bass: 0,
        treble: 0,
        playback: { is_playing: false }
      }
    ])
    .select()
    .single();

  if (error) return res.status(500).json({ error });

  res.json(data);
});

// UPDATE ZONE (MAIN CONTROL)
app.post("/api/zone/update", async (req, res) => {
  const {
    zone_code,
    master_volume,
    muted,
    current_asset_id,
    bass,
    treble,
    playback
  } = req.body;

  if (!zone_code) {
    return res.status(400).json({ error: "zone_code required" });
  }

  const { error } = await supabase
    .from("zones")
    .update({
      master_volume,
      muted,
      current_asset_id,
      bass,
      treble,
      playback,
      updated_at: new Date().toISOString()
    })
    .eq("zone_code", zone_code);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

// ======================================================
// GET ZONE STATE (ROBLOX + DASHBOARD)
// ======================================================
app.get("/api/zone/state", async (req, res) => {
  const { zone_code } = req.query;

  const { data: zone, error } = await supabase
    .from("zones")
    .select("*")
    .eq("zone_code", zone_code)
    .single();

  if (error)
    return res.status(500).json({ error });

  const { data: members, error: membersError } =
    await supabase
      .from("zone_members")
      .select("*")
      .eq("zone_id", zone.id);

  if (membersError)
    return res.status(500).json({ error: membersError });

  res.json({
    zone,
    members
  });
});

// ======================================================
// HEARTBEAT (ROBLOX)
// ======================================================
app.post("/api/heartbeat", async (req, res) => {
  const { game_id, amp_id } = req.body;

  const { error } = await supabase
    .from("amplifiers")
    .update({
      online: true,
      last_seen: new Date().toISOString()
    })
    .eq("game_id", game_id)
    .eq("amp_id", amp_id);

  if (error) return res.status(500).json({ error });

  res.json({ ok: true });
});

// ======================================================
// ZONE MEMBERS
// ======================================================

app.post("/api/zone/member/add", async (req, res) => {
  const { zone_code, amp_id } = req.body;

  const { error } = await supabase
    .from("zone_members")
    .insert([{ zone_code, amp_id }]);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

app.post("/api/zone/member/remove", async (req, res) => {
  const { zone_code, amp_id } = req.body;

  const { error } = await supabase
    .from("zone_members")
    .delete()
    .eq("zone_code", zone_code)
    .eq("amp_id", amp_id);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

// ======================================================
// PARTY MODE
// ======================================================
app.post("/api/party/activate", async (req, res) => {
  const { group_id } = req.body;

  const { data: zones } = await supabase
    .from("zone_group_members")
    .select("zone_code")
    .eq("group_id", group_id);

  const zoneCodes = zones.map(z => z.zone_code);

  const { error } = await supabase
    .from("zones")
    .update({
      muted: false,
      master_volume: 70
    })
    .in("zone_code", zoneCodes);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

// ======================================================
// GROUPS
// ======================================================
app.post("/api/group/create", async (req, res) => {
  const { game_id, name, master_zone_id } = req.body;

  const { data, error } = await supabase
    .from("zone_groups")
    .insert([{ game_id, name, master_zone_id }])
    .select()
    .single();

  if (error) return res.status(500).json({ error });

  res.json(data);
});

app.post("/api/group/add-zone", async (req, res) => {
  const { group_id, zone_code } = req.body;

  const { error } = await supabase
    .from("zone_group_members")
    .insert([{ group_id, zone_code }]);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

// ======================================================
// QUEUE SYSTEM
// ======================================================
app.post("/api/queue/add", async (req, res) => {
  const { zone_code, asset_id, title } = req.body;

  const { data, error } = await supabase
    .from("zone_queue")
    .insert([{ zone_code, asset_id, title }])
    .select()
    .single();

  if (error) return res.status(500).json({ error });

  res.json(data);
});

app.post("/api/queue/next", async (req, res) => {
  const { zone_code } = req.body;

  if (!zone_code) {
    return res.status(400).json({ error: "zone_code required" });
  }

  const { data: queue, error } = await supabase
    .from("zone_queue")
    .select("*")
    .eq("zone_code", zone_code)
    .order("position");

  if (error) return res.status(500).json({ error });

  if (!queue || queue.length === 0) {
    return res.json({ message: "empty queue" });
  }

  const next = queue[0];

  await supabase
    .from("zones")
    .update({
      current_asset_id: next.asset_id
    })
    .eq("zone_code", zone_code);

  await supabase
    .from("zone_queue")
    .delete()
    .eq("id", next.id);

  res.json(next);
});

// ======================================================
// CLEANUP OFFLINE AMPS
// ======================================================
setInterval(async () => {
  const cutoff = new Date(Date.now() - 60000).toISOString();

  const { error } = await supabase
    .from("amplifiers")
    .delete()
    .lt("last_seen", cutoff);

  if (error) console.error("cleanup error:", error);
}, 10000);

// ======================================================
// PLAYBACK DRIFT CORRECTION
// ======================================================
setInterval(async () => {
  const { data: zones } = await supabase
    .from("zones")
    .select("*");

  for (const zone of zones || []) {
    if (!zone.playback?.is_playing) continue;

    const started = new Date(zone.playback.started_at).getTime();
    const now = Date.now();

    const position = (now - started) / 1000;

    await supabase
      .from("zones")
      .update({
        playback: {
          ...zone.playback,
          position
        }
      })
      .eq("zone_code", zone.zone_code);
  }
}, 5000);

// ======================================================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
