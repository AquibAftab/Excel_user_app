import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Database,
  RefreshCw,
  Search,
  Trash2,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Pencil,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  FolderOpen
} from "lucide-react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/records";

function App() {
  const [history, setHistory] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [columns, setColumns] = useState([]);

  const [fileName, setFileName] = useState("");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "",
    direction: "asc"
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [editValues, setEditValues] = useState({});

  // Load upload history
  const fetchHistory = useCallback(async () => {
    try {
      setFetching(true);
      const response = await axios.get(`${API_URL}/imports`);
      setHistory(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load upload history.");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Load selected file records
  const openImport = async (item, preserveMessage = false) => {
    try {
      setFetching(true);
      setError("");
      if (!preserveMessage) {
        setMessage("");
      }

      const response = await axios.get(
        `${API_URL}/import/${item.importId}`
      );

      const records = response.data.records || [];

      const formatted = records.map(record => ({
        _id: record._id,
        ...record.data
      }));

      // Collect all unique column names across all rows in order
      const detectedColumns = [];
      formatted.forEach(row => {
        Object.keys(row).forEach(key => {
          if (key !== "_id" && !detectedColumns.includes(key)) {
            detectedColumns.push(key);
          }
        });
      });

      setSelectedImport(item);
      setTableData(formatted);
      setColumns(detectedColumns);
      setFileName(item.fileName);
      setSearch("");
      setPage(1);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load records.");
    } finally {
      setFetching(false);
    }
  };

  // Upload Excel or CSV
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const extension = file.name.split(".").pop().toLowerCase();

      if (!["xlsx", "xls", "csv"].includes(extension)) {
        throw new Error("Please upload an Excel or CSV file.");
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("The uploaded file does not contain any sheets.");
      }
      const worksheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: false,
        blankrows: false
      });

      const filteredRows = rows.filter(row =>
        Object.values(row).some(value =>
          String(value).trim() !== ""
        )
      );

      if (filteredRows.length === 0) {
        throw new Error("The uploaded file contains no records.");
      }

      const response = await axios.post(`${API_URL}/upload`, {
        fileName: file.name,
        rows: filteredRows
      });

      await fetchHistory();

      const newImport = {
        importId: response.data.importId,
        fileName: response.data.fileName,
        totalRecords: response.data.totalRecords,
        uploadedAt: new Date()
      };

      await openImport(newImport, true);

      setMessage(
        `${file.name} uploaded successfully. ${response.data.totalRecords} records saved.`
      );

    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Upload failed."
      );
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  // Search and filter records
  const filteredData = tableData.filter(row => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return columns.some(column =>
      String(row[column] ?? "")
        .toLowerCase()
        .includes(query)
    );
  });

  // Sort records
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const first = String(a[sortConfig.key] ?? "").toLowerCase();
    const second = String(b[sortConfig.key] ?? "").toLowerCase();

    const comparison = first.localeCompare(second, undefined, {
      numeric: true,
      sensitivity: "base"
    });

    return sortConfig.direction === "asc"
      ? comparison
      : -comparison;
  });

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(sortedData.length / pageSize)
  );

  // Clamp page if totalPages shrinks due to search/delete
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;

  const visibleData = sortedData.slice(
    startIndex,
    startIndex + pageSize
  );

  const handleSort = (column) => {
    setSortConfig(previous => ({
      key: column,
      direction:
        previous.key === column && previous.direction === "asc"
          ? "desc"
          : "asc"
    }));
  };

  // Delete complete file
  const deleteImport = async (item) => {
    if (!window.confirm(
      `Delete "${item.fileName}" and all its records? This cannot be undone.`
    )) return;

    try {
      await axios.delete(`${API_URL}/import/${item.importId}`);

      setMessage(`${item.fileName} deleted successfully.`);

      if (selectedImport?.importId === item.importId) {
        setSelectedImport(null);
        setTableData([]);
        setColumns([]);
      }

      await fetchHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete file.");
    }
  };

  // Delete individual row
  const deleteRow = async (id) => {
    if (!window.confirm("Delete this record?")) return;

    try {
      await axios.delete(`${API_URL}/row/${id}`);

      await openImport({
        ...selectedImport,
        totalRecords: Math.max(0, selectedImport.totalRecords - 1)
      }, true);

      setMessage("Record deleted successfully.");
      await fetchHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete record.");
    }
  };

  // Open edit dialog
  const startEditing = (row) => {
    setEditingRecord(row._id);
    setEditValues(
      Object.fromEntries(
        columns.map(column => [column, row[column] ?? ""])
      )
    );
  };

  // Save edited record
  const saveEdit = async () => {
    try {
      await axios.put(`${API_URL}/${editingRecord}`, {
        data: editValues
      });

      setEditingRecord(null);
      await openImport(selectedImport, true);
      setMessage("Record updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update record.");
    }
  };

  // Export visible filtered and sorted records
  const exportData = (format) => {
    if (sortedData.length === 0) {
      setError("No records available to export.");
      return;
    }

    const exportRows = sortedData.map(row => {
      const cleanRow = {};
      columns.forEach(col => {
        cleanRow[col] = row[col] ?? "";
      });
      return cleanRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: columns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Records");

    const safeName = fileName.replace(/\.[^/.]+$/, "") || "records";

    XLSX.writeFile(
      workbook,
      `${safeName}.${format}`,
      format === "csv" ? { bookType: "csv" } : {}
    );
  };

  return (
    <div className="app-container">

      <header className="header">
        <div className="brand">
          <FileSpreadsheet size={30} />
          <div>
            <h1>Excel & CSV Manager</h1>
            <p>Manage your files and records efficiently</p>
          </div>
        </div>

        <button className="refresh-button" onClick={fetchHistory}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <main className="main-content">

        {/* Messages */}
        {message && (
          <div className="success-message">
            <span>{message}</span>
            <button onClick={() => setMessage("")} aria-label="Dismiss message">
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Upload section */}
        <section className="upload-card">
          <div className="section-heading">
            <Upload size={22} />
            <div>
              <h2>Upload a new file</h2>
              <p>Supported formats: XLSX, XLS and CSV</p>
            </div>
          </div>

          <label className="upload-area">
            <Upload size={30} />
            <strong>
              {loading ? "Uploading..." : "Choose an Excel or CSV file"}
            </strong>
            <span>Click here to browse your files</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={loading}
              hidden
            />
          </label>
        </section>

        {/* Upload history */}
        {!selectedImport && (
          <section className="history-card">
            <div className="section-heading">
              <FolderOpen size={22} />
              <div>
                <h2>Upload History</h2>
                <p>Each file is stored and managed separately.</p>
              </div>
            </div>

            <div className="stats-row">
              <div className="stat-card">
                <Database size={22} />
                <span>Total files</span>
                <strong>{history.length}</strong>
              </div>

              <div className="stat-card">
                <FileSpreadsheet size={22} />
                <span>Total records</span>
                <strong>
                  {history.reduce(
                    (total, item) => total + item.totalRecords, 0
                  )}
                </strong>
              </div>
            </div>

            {fetching ? (
              <p className="empty-state">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="empty-state">
                No uploaded files yet. Upload your first file above.
              </p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>File name</th>
                      <th>Records</th>
                      <th>Upload date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.map(item => (
                      <tr key={item.importId}>
                        <td>
                          <div className="file-name-cell">
                            <FileSpreadsheet size={16} />
                            <span>{item.fileName}</span>
                          </div>
                        </td>
                        <td>{item.totalRecords}</td>
                        <td>
                          {new Date(item.uploadedAt).toLocaleString()}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="icon-button"
                              title="View records"
                              onClick={() => openImport(item)}
                            >
                              <Eye size={17} />
                            </button>

                            <button
                              className="icon-button delete-button"
                              title="Delete file"
                              onClick={() => deleteImport(item)}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Selected file view */}
        {selectedImport && (
          <section className="records-card">

            <div className="records-heading">
              <div>
                <button
                  className="back-button"
                  onClick={() => {
                    setSelectedImport(null);
                    setTableData([]);
                    setColumns([]);
                    setSearch("");
                    setPage(1);
                  }}
                >
                  <ArrowLeft size={16} /> Back to history
                </button>

                <h2>{selectedImport.fileName}</h2>
                <p>{tableData.length} records in this file</p>
              </div>
            </div>

            <div className="toolbar">
              <div className="search-box">
                <Search size={18} />
                <input
                  value={search}
                  placeholder="Search across all columns..."
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                {search && (
                  <button
                    className="clear-search-button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    title="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="export-buttons">
                <button onClick={() => exportData("xlsx")}>
                  <Download size={16} /> Excel
                </button>
                <button onClick={() => exportData("csv")}>
                  <Download size={16} /> CSV
                </button>
              </div>
            </div>

            <p className="results-count">
              Showing {filteredData.length === 0 ? 0 : startIndex + 1}
              {" - "}
              {Math.min(startIndex + pageSize, sortedData.length)}
              {" of "}
              {sortedData.length} records
            </p>

            {visibleData.length === 0 ? (
              <p className="empty-state">No matching records found.</p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      {columns.map(column => {
                        const isSorted = sortConfig.key === column;
                        return (
                          <th key={column}>
                            <button
                              className={`sort-button ${isSorted ? "active" : ""}`}
                              onClick={() => handleSort(column)}
                            >
                              {column}
                              {isSorted ? (
                                sortConfig.direction === "asc" ? (
                                  <ArrowUp size={14} />
                                ) : (
                                  <ArrowDown size={14} />
                                )
                              ) : (
                                <ArrowUpDown size={14} />
                              )}
                            </button>
                          </th>
                        );
                      })}
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleData.map(row => (
                      <tr key={row._id}>
                        {columns.map(column => (
                          <td key={column}>
                            {String(row[column] ?? "")}
                          </td>
                        ))}

                        <td>
                          <div className="action-buttons">
                            <button
                              className="icon-button"
                              title="Edit record"
                              onClick={() => startEditing(row)}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              className="icon-button delete-button"
                              title="Delete record"
                              onClick={() => deleteRow(row._id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pagination">
              <div>
                Rows per page:
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="page-controls">
                <span>Page {page} of {totalPages}</span>

                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* Edit dialog */}
      {editingRecord && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <div className="modal-heading">
              <h2>Edit record</h2>
              <button onClick={() => setEditingRecord(null)} aria-label="Close edit modal">
                <X size={20} />
              </button>
            </div>

            {columns.map(column => (
              <label className="edit-field" key={column}>
                {column}
                <input
                  value={editValues[column] ?? ""}
                  onChange={e =>
                    setEditValues(previous => ({
                      ...previous,
                      [column]: e.target.value
                    }))
                  }
                />
              </label>
            ))}

            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setEditingRecord(null)}
              >
                Cancel
              </button>

              <button className="save-button" onClick={saveEdit}>
                <Save size={16} /> Save changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
