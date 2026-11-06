const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Record = require("../models/Record");

const router = express.Router();

// 1. Upload a file's records
router.post("/upload", async (req, res) => {
  try {
    const { fileName, rows } = req.body;

    if (!fileName || typeof fileName !== "string" || !fileName.trim() || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        message: "File name and non-empty rows are required."
      });
    }

    if (!rows.every(row =>
      row && typeof row === "object" && !Array.isArray(row)
    )) {
      return res.status(400).json({
        message: "Every row must be a valid object."
      });
    }

    const importId = crypto.randomUUID();
    const uploadedAt = new Date();

    const records = rows.map((row, index) => ({
      importId,
      fileName: fileName.trim(),
      rowNumber: index + 1,
      data: row,
      uploadedAt
    }));

    await Record.insertMany(records);

    res.status(201).json({
      message: "File uploaded successfully.",
      importId,
      fileName: fileName.trim(),
      totalRecords: records.length
    });

  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// 2. Get upload history
router.get("/imports", async (req, res) => {
  try {
    const records = await Record.find({}, "importId fileName uploadedAt")
      .sort({ uploadedAt: -1 })
      .lean();

    const groupedImports = new Map();

    records.forEach(record => {
      if (!groupedImports.has(record.importId)) {
        groupedImports.set(record.importId, {
          importId: record.importId,
          fileName: record.fileName,
          uploadedAt: record.uploadedAt,
          totalRecords: 0
        });
      }

      groupedImports.get(record.importId).totalRecords++;
    });

    const history = Array.from(groupedImports.values());

    res.json(history);

  } catch (error) {
    console.error("Upload History Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// 3. Get records for one uploaded file
router.get("/import/:importId", async (req, res) => {
  try {
    const { importId } = req.params;

    const records = await Record.find({
      importId
    })
      .sort({ rowNumber: 1 })
      .lean();

    res.json({
      totalRecords: records.length,
      records
    });

  } catch (error) {
    console.error("Fetch Records Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// 4. Edit an individual record
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid record ID."
      });
    }

    const { data } = req.body;

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({
        message: "Valid record data is required."
      });
    }

    const record = await Record.findByIdAndUpdate(
      id,
      { $set: { data } },
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({
        message: "Record not found."
      });
    }

    res.json({
      message: "Record updated successfully.",
      record
    });

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// 5. Delete an individual record
router.delete("/row/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid record ID."
      });
    }

    const record = await Record.findByIdAndDelete(id);

    if (!record) {
      return res.status(404).json({
        message: "Record not found."
      });
    }

    res.json({
      message: "Record deleted successfully."
    });

  } catch (error) {
    console.error("Delete Row Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// 6. Delete an entire uploaded file
router.delete("/import/:importId", async (req, res) => {
  try {
    const { importId } = req.params;

    if (!importId) {
      return res.status(400).json({
        message: "Import ID is required."
      });
    }

    const result = await Record.deleteMany({
      importId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "No records found for the specified import ID.",
        deletedRecords: 0
      });
    }

    res.json({
      message: "Uploaded file deleted successfully.",
      deletedRecords: result.deletedCount
    });

  } catch (error) {
    console.error("Delete Import Error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
