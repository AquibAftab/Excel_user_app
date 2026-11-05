
const express = require("express");
const crypto = require("crypto");

const Record = require("../models/Record");

const router = express.Router();


// =====================================
// 1. POST API - UPLOAD EXCEL RECORDS
// =====================================

router.post("/upload", async (req, res) => {

  try {

    const { fileName, rows } = req.body;

    // Validate request

    if (
      !fileName ||
      typeof fileName !== "string" ||
      !Array.isArray(rows) ||
      rows.length === 0
    ) {

      return res.status(400).json({
        message: "Invalid file data or empty rows."
      });

    }

    if (
      rows.some(
        (row) =>
          row === null ||
          typeof row !== "object" ||
          Array.isArray(row)
      )
    ) {

      return res.status(400).json({
        message: "Invalid spreadsheet row format."
      });

    }

    // Generate unique upload ID

    const importId = crypto.randomUUID();

    // Prepare MongoDB documents

    const records = rows.map((row, index) => ({

      importId,

      fileName,

      rowNumber: index + 1,

      data: row

    }));


    // Save records in MongoDB

    await Record.insertMany(records);


    res.status(201).json({

      message: "Records saved successfully!",

      importId,

      totalRecords: records.length

    });


  } catch (error) {

    console.error("Upload Error:", error);

    res.status(500).json({

      message: "Failed to save records.",

      error: error.message

    });

  }

});


// =====================================
// 2. GET API - FETCH ALL RECORDS
// =====================================

router.get("/", async (req, res) => {

  try {

    const records = await Record.find()

      .sort({
        uploadedAt: -1,
        rowNumber: 1
      })

      .lean();


    res.status(200).json({

      totalRecords: records.length,

      records

    });


  } catch (error) {

    console.error("Fetch Error:", error);

    res.status(500).json({

      message: "Failed to fetch records.",

      error: error.message

    });

  }

});


// =====================================
// 3. GET API - FETCH SPECIFIC UPLOAD
// =====================================

router.get("/import/:importId", async (req, res) => {

  try {

    const records = await Record.find({

      importId: req.params.importId

    })

      .sort({
        rowNumber: 1
      })

      .lean();


    res.status(200).json({

      totalRecords: records.length,

      records

    });


  } catch (error) {

    console.error("Import Fetch Error:", error);

    res.status(500).json({

      message: "Failed to fetch imported records.",

      error: error.message

    });

  }

});


module.exports = router;
