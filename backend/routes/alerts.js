const express = require("express");
const Alert = require("../models/Alert");

const router = express.Router();

/* =====================================================
   CREATE ALERT
   POST /api/alerts
===================================================== */
router.post("/", async (req, res) => {
  try {
    const { plate, property, zone, reason, urgency, note } = req.body;

    if (!plate || !property || !zone || !reason) {
      return res.status(400).json({
        message: "plate, property, zone, reason are required"
      });
    }

    const alert = await Alert.create({
      plate,
      property,
      zone,
      reason,
      urgency: urgency || "Normal",
      note: note || "",
      status: "sent"
    });

    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* =====================================================
   GET ALL ALERTS
   GET /api/alerts
===================================================== */
router.get("/", async (req, res) => {
  try {
    const alerts = await Alert
      .find()
      .sort({ createdAt: -1 })
      .limit(300);

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* =====================================================
   UPDATE ALERT (status / owner response)
   PATCH /api/alerts/:id
===================================================== */
router.patch("/:id", async (req, res) => {
  try {
    const { status, ownerResponse, respondedAt } = req.body;

    const update = {};

    // update status if provided
    if (status) update.status = status;

    // owner response support (important for Owner page)
    if (ownerResponse !== undefined) {
      update.ownerResponse = ownerResponse;

      // auto set respondedAt
      update.respondedAt = respondedAt || new Date();

      // auto set status if not provided
      if (!status) update.status = "responded";
    }

    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    res.json(alert);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* =====================================================
   DELETE ALERT (optional)
   DELETE /api/alerts/:id
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Alert.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Alert not found" });
    }

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
