const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ API routes
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "parkguard-backend" });
});

app.use("/api/alerts", require("./routes/alerts"));

// ✅ Serve FRONTEND folder (ParkGuard/frontend)
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

// ✅ Pages
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/guard", (req, res) => {
  res.sendFile(path.join(frontendPath, "guard.html"));
});

app.get("/owner", (req, res) => {
  res.sendFile(path.join(frontendPath, "owner.html"));
});

// ✅ Fallback (prevents refresh 404 on Render)
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ✅ IMPORTANT: Render uses process.env.PORT
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`✅ ParkGuard running at http://localhost:${PORT}`));
