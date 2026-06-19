import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const PORT = process.env.PORT || 3000;

// =====================
// HEALTH
// =====================
app.get("/", (req, res) => {
  res.json({ status: "ok" });
});


// ======================================================
// ZONES
// ======================================================

// GET ZONES
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

  const { data, error } = await supabase
    .from("zones")
    .insert([{ game_id, name }])
    .select()
    .single();

  if (error) return res.status(500).json({ error });

  res.json(data);
});

// UPDATE ZONE (MAIN CONTROL)
app.post("/api/zone/update", async (req, res) => {
  const { zone_id, master_volume, muted, current_asset_id } = req.body;

  const { error } = await supabase
    .from("zones")
    .update({
      master_volume,
      muted,
      current_asset_id,
      updated_at: new Date().toISOString()
    })
    .eq("id", zone_id);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});


// ======================================================
// ZONE MEMBERS (NEW CORE SYSTEM)
// ======================================================

// ADD AMP TO ZONE
app.post("/api/zone/member/add", async (req, res) => {
  const { zone_id, amp_id } = req.body;

  const { error } = await supabase
    .from("zone_members")
    .insert([{ zone_id, amp_id }]);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

// REMOVE AMP FROM ZONE
app.post("/api/zone/member/remove", async (req, res) => {
  const { zone_id, amp_id } = req.body;

  const { error } = await supabase
    .from("zone_members")
    .delete()
    .eq("zone_id", zone_id)
    .eq("amp_id", amp_id);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});


// ======================================================
// GET FULL ZONE STATE (IMPORTANT NEW ENDPOINT)
// ======================================================
app.get("/api/zone/state", async (req, res) => {
  const { zone_id } = req.query;

  // zone
  const { data: zone, error: zoneError } = await supabase
    .from("zones")
    .select("*")
    .eq("id", zone_id)
    .single();

  if (zoneError) return res.status(500).json({ error: zoneError });

  // members
  const { data: members, error: memberError } = await supabase
    .from("zone_members")
    .select("*")
    .eq("zone_id", zone_id);

  if (memberError) return res.status(500).json({ error: memberError });

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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
