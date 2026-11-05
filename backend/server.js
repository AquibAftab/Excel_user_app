
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const app = express();


// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());

app.use(express.json({
  limit: "10mb"
}));


// =====================================
// API ROUTES
// =====================================

app.use(
  "/api/records",
  require("./routes/records")
);


// Test API

app.get("/", (req, res) => {

  res.send(
    "Excel Management Backend is Running!"
  );

});


// =====================================
// MONGODB CONNECTION
// =====================================

async function startServer() {

  try {

    if (!process.env.MONGO_URI) {

      throw new Error(
        "MONGO_URI is missing from .env file."
      );

    }

    console.log("Starting backend...");

    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      "MongoDB Connected Successfully!"
    );


    // Start server after DB connection

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {

      console.log(
        `Server running on port ${PORT}`
      );

    });


  } catch (error) {

    console.error(
      "Backend Connection Error:",
      error.message
    );

    process.exit(1);

  }

}


startServer();
