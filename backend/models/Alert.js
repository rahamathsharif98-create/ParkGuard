const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema(
  {
    plate: { type: String, required: true, uppercase: true, trim: true },
    property: { type: String, required: true, trim: true },
    zone: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    urgency: { type: String, enum: ["Normal", "High"], default: "Normal" },
    note: { type: String, default: "" },

    status: {
      type: String,
      enum: ["sent", "viewed", "responded", "escalated", "resolved"],
      default: "sent"
    },

    ownerResponse: { type: String, default: null },
    respondedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Alert", AlertSchema);
