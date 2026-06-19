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
  const { game_id, amp_id, name, zone } = req.body

  const { error } = await supabase
    .from("amplifiers")
    .upsert({
      game_id,
      amp_id,
      name,
      zone,
      online: true,
      last_seen: new Date().toISOString()
    })

  if (error) {
    console.log("SUPABASE ERROR:", error)
  }

  await supabase
    .from("zones")
    .upsert({
      game_id,
      name: zone
    })

  res.json({ success: true })
})

app.post("/api/update", async (req, res) => {
  const { game_id, amp_id, volume, bass, treble, muted, current_asset_id  } = req.body

  console.log("UPDATE REQUEST:", req.body)
  
  await supabase
    .from("amplifiers")
    .update({
      volume,
      bass,
      treble,
      muted,
      current_asset_id,
      online: true,
      last_seen: new Date().toISOString()
    })
    .eq("amp_id", amp_id)
    .eq("game_id", game_id)

  if (error) {
    console.log("UPDATE ERROR:", error)
    return res.status(500).json({ error })
  }

  res.json({ success: true })
})

app.get("/api/amplifiers", async (req, res) => {
  const { game_id } = req.query

  let query = supabase
    .from("amplifiers")
    .select("*")
    .order("zone")

  if (game_id) {
    query = query.eq("game_id", game_id)
  }

  const { data, error } = await query

  if (error) {
    return res.status(500).json(error)
  }

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

setInterval(async () => {
  const cutoff = new Date(Date.now() - 15000).toISOString()

  const { error } = await supabase
    .from("amplifiers")
    .update({ online: false })
    .lt("last_seen", cutoff)

  if (error) {
    console.error("Offline cleanup error:", error)
  }
}, 5000)
const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Control1 API running on port ${PORT}`)
})
