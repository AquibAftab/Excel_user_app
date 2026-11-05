
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

import {
  Upload,
  FileSpreadsheet,
  Database,
  RefreshCw
} from "lucide-react";

import "./App.css";

function App() {
  // Backend API
  const API_URL = "http://localhost:5000/api/records";

  // React states
  const [fileName, setFileName] = useState("");
  const [tableData, setTableData] = useState([]);
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // =====================================
  // 1. FETCH RECORDS FROM MONGODB
  // =====================================

  const fetchRecords = useCallback(async () => {
    try {
      setFetching(true);
      setError("");

      const response = await axios.get(API_URL);

      const records = response.data.records || [];

      // Extract actual spreadsheet data
      const formattedData = records.map(
        (record) => record.data
      );

      setTableData(formattedData);

      if (records.length > 0) {
        setFileName("Saved records from MongoDB");
      } else {
        setFileName("");
      }

      console.log("Records fetched:", records.length);

    } catch (err) {
      console.error("Fetch Error:", err);

      setError(
        "Unable to fetch records from MongoDB."
      );

    } finally {
      setFetching(false);
    }
  }, []);

  // Fetch records when application loads
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);


  // =====================================
  // 2. HANDLE EXCEL / CSV UPLOAD
  // =====================================

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setError("");
    setUploadMessage("");
    setFileName(file.name);

    const allowedExtensions = [
      ".xlsx",
      ".xls",
      ".csv"
    ];

    const isValidFile = allowedExtensions.some(
      (extension) =>
        file.name.toLowerCase().endsWith(extension)
    );

    if (!isValidFile) {
      setError("Please upload a valid Excel or CSV file.");
      event.target.value = "";
      return;
    }

    try {
      // Read uploaded file
      const data = await file.arrayBuffer();

      // Parse workbook
      const workbook = XLSX.read(data);

      if (!workbook.SheetNames.length) {
        throw new Error("No worksheet found.");
      }

      // Get first worksheet
      const sheetName = workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];

      // Convert Excel data into JSON
      const jsonData = XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: "",
          raw: false,
          blankrows: false
        }
      );

      // Remove empty rows
      const filteredData = jsonData.filter((row) =>
        Object.values(row).some(
          (value) => String(value).trim() !== ""
        )
      );

      if (filteredData.length === 0) {
        setError("No data found in the uploaded file.");
        return;
      }

      // Display preview immediately
      setTableData(filteredData);

      // Send data to Node.js backend
      setLoading(true);

      const response = await axios.post(
        `${API_URL}/upload`,
        {
          fileName: file.name,
          rows: filteredData
        }
      );

      // Upload successful
      setUploadMessage(
        `${response.data.totalRecords} records saved successfully in MongoDB!`
      );

      // Fetch saved records from database
      await fetchRecords();

    } catch (err) {
      console.error("Upload Error:", err);

      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to upload file."
      );

    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };


  // =====================================
  // 3. GENERATE DYNAMIC TABLE COLUMNS
  // =====================================

  const columns = Object.keys(tableData[0] || {});


  // =====================================
  // 4. FRONTEND UI
  // =====================================

  return (
    <div className="app">

      {/* Navigation Bar */}

      <header className="navbar">

        <h2>
          <Database size={25} />
          DataManager
        </h2>

        <span>
          Excel & CSV Management System
        </span>

      </header>


      <main className="container">

        {/* Dashboard Heading */}

        <h1>Data Management Dashboard</h1>

        <p>
          Upload, preview and manage your spreadsheet data.
        </p>


        {/* Upload Section */}

        <section className="upload-box">

          <FileSpreadsheet
            size={55}
            color="#2563eb"
          />

          <h2>Upload Your Spreadsheet</h2>

          <p>
            Choose an Excel or CSV file to get started.
          </p>

          <label className="upload-button">

            <Upload size={18} />

            {loading ? "Uploading..." : "Choose File"}

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={loading}
              hidden
            />

          </label>


          {/* Selected File */}

          {fileName && (
            <p className="file-name">
              Selected file: {fileName}
            </p>
          )}


          {/* Upload Progress */}

          {loading && (
            <p style={{ color: "#2563eb" }}>
              Saving records to MongoDB...
            </p>
          )}


          {/* Success Message */}

          {uploadMessage && (
            <p style={{ color: "green", fontWeight: "bold" }}>
              {uploadMessage}
            </p>
          )}


          {/* Error Message */}

          {error && (
            <p style={{ color: "red", fontWeight: "bold" }}>
              {error}
            </p>
          )}

        </section>


        {/* Uploaded Data Section */}

        <section className="table-section">

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>

            <h2>Uploaded Data</h2>

            <button
              onClick={fetchRecords}
              disabled={fetching}
              style={{
                cursor: "pointer",
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #2563eb",
                background: "white",
                color: "#2563eb"
              }}
            >
              <RefreshCw
                size={14}
                style={{ marginRight: "5px" }}
              />

              {fetching ? "Refreshing..." : "Refresh Data"}

            </button>

          </div>


          {/* Record Information */}

          {tableData.length > 0 && (

            <p>
              Total Records: {tableData.length}
            </p>

          )}


          {/* Loading */}

          {fetching && tableData.length === 0 && (
            <p>Loading records from MongoDB...</p>
          )}


          {/* Dynamic Table */}

          {tableData.length > 0 ? (

            <div className="table-wrapper">

              <table className="data-table">

                <thead>

                  <tr>

                    {columns.map((column, index) => (
                      <th key={index}>
                        {column}
                      </th>
                    ))}

                  </tr>

                </thead>


                <tbody>

                  {tableData.map((row, rowIndex) => (

                    <tr key={rowIndex}>

                      {columns.map((column, colIndex) => (

                        <td key={colIndex}>
                          {String(row[column] ?? "")}
                        </td>

                      ))}

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          ) : (

            !fetching && (
              <p>
                No records available. Upload an Excel or CSV file.
              </p>
            )

          )}

        </section>

      </main>

    </div>
  );
}

export default App;
