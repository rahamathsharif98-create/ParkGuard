const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");

dotenv.config();

// Connect DB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "parkguard-backend" });
});

// ✅ API routes
app.use("/api/alerts", require("./routes/alerts"));

// ✅ Serve FRONTEND folder (IMPORTANT FIX)
// Your files are here: /frontend/index.html, guard.html, owner.html
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

// ✅ Default route
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ✅ If frontend refreshes any route, still load index.html
app.get("*", (req, res) => {
  // Prevent catching API routes
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found" });
  }
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`✅ ParkGuard running on port ${PORT}`);
});
