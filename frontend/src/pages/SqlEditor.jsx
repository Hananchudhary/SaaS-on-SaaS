import { useState } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';

const TIER_HINTS = {
  1: 'Allowed: SELECT, INSERT, UPDATE, DELETE',
  2: 'Allowed: SELECT, UPDATE',
  3: 'Allowed: SELECT only',
};

export default function SqlEditor() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [lastResponse, setLastResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const executeQuery = async () => {
    if (!query.trim()) {
      showToast('Please enter a SQL query', 'warning');
      return;
    }
    setLoading(true);
    setResults(null);
    setLastResponse(null);
    try {
      const res = await api.post('/query', { query: query.trim() });
      setResults(res.data);
      // Only store for export if it was a SELECT
      if (res.data?.data?.rows_count !== undefined) {
        setLastResponse(res.data);
      }
      showToast('Query executed successfully', 'success');
    } catch (err) {
      const errData = err.response?.data;
      const msg = errData?.error?.details || errData?.error?.message || 'Query execution failed';
      showToast(msg, 'error');
      setResults({ success: false, error: errData?.error || { message: msg } });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type) => {
    if (!lastResponse) return;
    setExporting(true);
    try {
      const sessionId = sessionStorage.getItem('session_id');
      const ext = type.toLowerCase() === 'pdf' ? 'pdf' : 'xlsx';
      const contentType = type.toLowerCase() === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
      // Use fetch API directly for blob downloads to avoid axios response parsing issues
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/exportData`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          responseData: lastResponse,
          exportType: type,
        }),
      });

      if (!response.ok) {
        // Try to parse error response
        const contentTypeHeader = response.headers.get('content-type');
        if (contentTypeHeader && contentTypeHeader.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData?.error?.message || 'Export failed');
        }
        throw new Error(`Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`${type} export downloaded`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
    }
  };

  const formatCell = (value) => {
    if (value === null || value === undefined) return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>NULL</span>;
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return String(value);
  };

  return (
    <>
      <div className="page-header">
        <h2>SQL Editor</h2>
        <p>Execute queries against your tenant data</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <textarea
          className="sql-editor-textarea"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your SQL query here... (Ctrl+Enter to execute)"
          spellCheck={false}
        />
        <div className="query-toolbar">
          <button className="btn btn-primary" onClick={executeQuery} disabled={loading || !query.trim()}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Running...</> : '▶ Execute'}
          </button>
          <div className="tier-hint">
            {TIER_HINTS[user?.tier_level] || 'Unknown tier'}
          </div>
        </div>
      </div>

      {results && (
        <div className="card fade-in">
          {results.success === false ? (
            <div className="alert alert-error">
              <span>✗</span>
              <div>
                <strong>Query Failed</strong>
                <p style={{ marginTop: 4 }}>{results.error?.details || results.error?.message}</p>
              </div>
            </div>
          ) : (
            <>
              {results.data?.rows_count !== undefined && (
                <>
                  <div className="card-header">
                    <h3 className="card-title">Results ({results.data.rows_count} row{results.data.rows_count !== 1 ? 's' : ''})</h3>
                  </div>
                  {results.data.rows_count > 0 ? (
                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {Object.keys(results.data.rows[0]).map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.data.rows.map((row, i) => (
                            <tr key={i}>
                              {Object.values(row).map((val, j) => (
                                <td key={j}>{formatCell(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '20px' }}>
                      <p>Query returned 0 rows</p>
                    </div>
                  )}
                </>
              )}

              {results.data?.insertId !== undefined && (
                <div className="alert alert-success">
                  <span>✓</span> INSERT successful. New ID: <strong>{results.data.insertId}</strong>
                </div>
              )}

              {results.data?.affectedRows !== undefined && (
                <div className="alert alert-success">
                  <span>✓</span> {results.data.affectedRows} row{results.data.affectedRows !== 1 ? 's' : ''} affected
                </div>
              )}

              {results.data?.message && (
                <div className="alert alert-info">
                  <span>ℹ</span> {results.data.message}
                </div>
              )}
            </>
          )}

          {lastResponse && lastResponse.data?.rows_count > 0 && (
            <div className="export-bar">
              <span>Export results:</span>
              <button className="btn btn-secondary btn-sm" onClick={() => handleExport('PDF')} disabled={exporting}>
                📄 PDF
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleExport('EXCEL')} disabled={exporting}>
                📊 Excel
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}