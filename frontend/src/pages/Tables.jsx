import { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../ToastContext';

export default function Tables() {
  const { showToast } = useToast();
  const [tables, setTables] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await api.get('/tables');
        const data = res.data?.data?.tables || [];
        setTables(data);
        if (data.length > 0) setActiveTab(data[0].table_name);
      } catch (err) {
        showToast(err.response?.data?.error?.message || 'Failed to load tables', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchTables();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading table data...</p>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <>
        <div className="page-header">
          <h2>Tables</h2>
          <p>Browse your data</p>
        </div>
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No table data available</p>
        </div>
      </>
    );
  }

  const activeTable = tables.find((t) => t.table_name === activeTab);

  const formatCell = (value) => {
    if (value === null || value === undefined) return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>NULL</span>;
    if (typeof value === 'boolean') return value ? '✓ Yes' : '✗ No';
    if (typeof value === 'object' && value instanceof Date) return value.toLocaleString();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return String(value);
  };

  return (
    <>
      <div className="page-header">
        <h2>Tables</h2>
        <p>Browse and inspect your tenant data ({tables.length} tables)</p>
      </div>

      <div className="tabs">
        {tables.map((t) => (
          <button
            key={t.table_name}
            className={`tab ${activeTab === t.table_name ? 'active' : ''}`}
            onClick={() => setActiveTab(t.table_name)}
          >
            {t.table_name} ({t.row_count})
          </button>
        ))}
      </div>

      {activeTable && (
        <div className="card fade-in" key={activeTab}>
          <div className="card-header">
            <h3 className="card-title">{activeTable.table_name}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {activeTable.row_count} row{activeTable.row_count !== 1 ? 's' : ''}
            </span>
          </div>

          {activeTable.data.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <p>No data in this table</p>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {activeTable.columns.map((col) => (
                      <th key={col.name}>
                        {col.name}
                        {col.is_primary && <span title="Primary Key" style={{ marginLeft: 4, color: 'var(--accent-primary)' }}>🔑</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeTable.data.map((row, i) => (
                    <tr key={i}>
                      {activeTable.columns.map((col) => (
                        <td key={col.name}>{formatCell(row[col.name])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}