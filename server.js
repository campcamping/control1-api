require("dotenv").config()

const express = require("express")
const cors = require("cors")

const { createClient } = require("@supabase/supabase-js")

const app = express()

app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

app.post("/api/register", async (req, res) => {
  const { amp_id, name, zone } = req.body

  // insert amp
  const { error } = await supabase
    .from("amplifiers")
    .upsert({
      amp_id,
      name,
      zone,
      online: true,
      last_seen: new Date()
    })

  // auto-create zone if it doesn't exist
  await supabase
    .from("zones")
    .upsert({ name: zone })

  res.json({ success: true })
})

app.post("/api/update", async (req, res) => {
  const { amp_id, volume, bass, treble, muted, asset_id } = req.body

  await supabase
    .from("amplifiers")
    .update({
      volume,
      bass,
      treble,
      muted,
      current_asset_id: asset_id,
      last_seen: new Date()
    })
    .eq("amp_id", amp_id)

  res.json({ success: true })
})

app.get("/api/amplifiers", async (req, res) => {
  const { data } = await supabase
    .from("amplifiers")
    .select("*")
    .order("zone")

  res.json(data)
})

app.post("/api/play", async (req, res) => {
  const { amp_id, asset_id } = req.body

  await supabase
    .from("amplifiers")
    .update({
      current_asset_id: asset_id
    })
    .eq("amp_id", amp_id)

  res.json({ success: true })
})
