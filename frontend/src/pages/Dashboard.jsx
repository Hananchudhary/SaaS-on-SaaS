import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/statics');
        setStats(res.data.data);
      } catch (err) {
        showToast(err.response?.data?.error?.message || 'Failed to load statistics', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <p>Unable to load dashboard data. Please check your connection.</p>
      </div>
    );
  }

  const userTierData = [
    { name: 'Tier 1 (Admin)', value: Number(stats.users?.tier_1_count) || 0 },
    { name: 'Tier 2 (Editor)', value: Number(stats.users?.tier_2_count) || 0 },
    { name: 'Tier 3 (Viewer)', value: Number(stats.users?.tier_3_count) || 0 },
  ].filter((d) => d.value > 0);

  const planData = (stats.plans?.plans || []).map((p, i) => ({
    name: p.plan_name,
    subscribed: Number(p.subscribed) || 0,
  }));

  const formatStorage = (bytes) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome back, {user?.username}</p>
      </div>

      {user?.warning && (
        <div className="alert alert-warning">
          <span>⚠</span> {user.warning}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{stats.users?.total_users || 0}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{stats.users?.active_users || 0}</div>
          <div className="stat-label">Active Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔗</div>
          <div className="stat-value">{stats.active_sessions || 0}</div>
          <div className="stat-label">Active Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💾</div>
          <div className="stat-value">{formatStorage(stats.storage || 0)}</div>
          <div className="stat-label">Est. Storage</div>
        </div>
      </div>

      <div className="charts-grid">
        {userTierData.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">User Distribution by Tier</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={userTierData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {userTierData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {planData.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Plan Subscriptions</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={planData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#374151' }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#374151' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }} />
                <Bar dataKey="subscribed" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}