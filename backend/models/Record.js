const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema(
  {
    importId: {
      type: String,
      required: true,
      index: true
    },
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    rowNumber: {
      type: Number,
      required: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {}
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

module.exports = mongoose.model("Record", recordSchema);
