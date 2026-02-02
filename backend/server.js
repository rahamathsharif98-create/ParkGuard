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

// ✅ Serve frontend (public folder)
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// ✅ Default route -> index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// ✅ If user opens /guard -> redirect to guard.html (optional)
app.get("/guard", (req, res) => {
  res.redirect("/guard.html");
});

// ✅ Any other route -> index.html (prevents refresh errors)
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`✅ ParkGuard running at http://localhost:${PORT}`));
