import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../ToastContext';
import api from '../api';

const initialForm = {
  company_name: '', email: '', phone: '', address: '',
  plan_name1: '', tier1_users_plan1: '', tier2_users_plan1: '', tier3_users_plan1: '', price_plan1: '',
  plan_name2: '', tier1_users_plan2: '', tier2_users_plan2: '', tier3_users_plan2: '', price_plan2: '',
  plan_name3: '', tier1_users_plan3: '', tier2_users_plan3: '', tier3_users_plan3: '', price_plan3: '',
  plan_id: '',
  username: '', admin_email: '', password: '', confirmPassword: '',
};

export default function Signup() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.company_name.trim()) errs.company_name = 'Required';
    if (!form.email.trim()) errs.email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email';

    for (let i = 1; i <= 3; i++) {
      if (!form[`plan_name${i}`].trim()) errs[`plan_name${i}`] = 'Required';
      if (!form[`price_plan${i}`] || Number(form[`price_plan${i}`]) < 0) errs[`price_plan${i}`] = 'Invalid price';
      ['tier1', 'tier2', 'tier3'].forEach((t) => {
        const key = `${t}_users_plan${i}`;
        if (form[key] === '' || Number(form[key]) < 0) errs[key] = '≥0';
      });
    }

    if (!form.plan_id) errs.plan_id = 'Select a plan';
    if (!form.username.trim()) errs.username = 'Required';
    if (!form.admin_email.trim()) errs.admin_email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(form.admin_email)) errs.admin_email = 'Invalid email';
    if (!form.password) errs.password = 'Required';
    else if (form.password.length < 4) errs.password = 'Min 4 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      payload.plan_id = parseInt(payload.plan_id, 10);
      for (let i = 1; i <= 3; i++) {
        payload[`tier1_users_plan${i}`] = parseInt(payload[`tier1_users_plan${i}`], 10);
        payload[`tier2_users_plan${i}`] = parseInt(payload[`tier2_users_plan${i}`], 10);
        payload[`tier3_users_plan${i}`] = parseInt(payload[`tier3_users_plan${i}`], 10);
        payload[`price_plan${i}`] = parseFloat(payload[`price_plan${i}`]);
      }
      await api.post('/signup', payload);
      showToast('Account created successfully! Please log in.', 'success');
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Signup failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const PlanFields = ({ n, label }) => (
    <div className="signup-section">
      <h3>{label}</h3>
      <div className="form-group">
        <label className="form-label">Plan Name</label>
        <input className={`form-input ${errors[`plan_name${n}`] ? 'error' : ''}`} value={form[`plan_name${n}`]} onChange={set(`plan_name${n}`)} placeholder={`Plan ${n} name`} />
        {errors[`plan_name${n}`] && <div className="form-error">{errors[`plan_name${n}`]}</div>}
      </div>
      <div className="form-row-3">
        <div className="form-group">
          <label className="form-label">Tier 1 Users</label>
          <input type="number" min="0" className={`form-input ${errors[`tier1_users_plan${n}`] ? 'error' : ''}`} value={form[`tier1_users_plan${n}`]} onChange={set(`tier1_users_plan${n}`)} />
        </div>
        <div className="form-group">
          <label className="form-label">Tier 2 Users</label>
          <input type="number" min="0" className={`form-input ${errors[`tier2_users_plan${n}`] ? 'error' : ''}`} value={form[`tier2_users_plan${n}`]} onChange={set(`tier2_users_plan${n}`)} />
        </div>
        <div className="form-group">
          <label className="form-label">Tier 3 Users</label>
          <input type="number" min="0" className={`form-input ${errors[`tier3_users_plan${n}`] ? 'error' : ''}`} value={form[`tier3_users_plan${n}`]} onChange={set(`tier3_users_plan${n}`)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Monthly Price ($)</label>
        <input type="number" step="0.01" min="0" className={`form-input ${errors[`price_plan${n}`] ? 'error' : ''}`} value={form[`price_plan${n}`]} onChange={set(`price_plan${n}`)} placeholder="0.00" />
        {errors[`price_plan${n}`] && <div className="form-error">{errors[`price_plan${n}`]}</div>}
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <div className="auth-brand">
          <h1>Create Account</h1>
          <p>Set up your company on our SaaS platform</p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="signup-section">
            <h3>Company Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input className={`form-input ${errors.company_name ? 'error' : ''}`} value={form.company_name} onChange={set('company_name')} placeholder="Your Company" />
                {errors.company_name && <div className="form-error">{errors.company_name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Company Email *</label>
                <input type="email" className={`form-input ${errors.email ? 'error' : ''}`} value={form.email} onChange={set('email')} placeholder="info@company.com" />
                {errors.email && <div className="form-error">{errors.email}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={set('phone')} placeholder="+1-555-0100" />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={set('address')} placeholder="123 Main St" />
              </div>
            </div>
          </div>

          <PlanFields n={1} label="Plan 1 — Basic" />
          <PlanFields n={2} label="Plan 2 — Professional" />
          <PlanFields n={3} label="Plan 3 — Enterprise" />

          <div className="signup-section">
            <h3>Select Subscription Plan</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Choose which plan to subscribe to initially. The plan_id will be auto-assigned based on creation order.</p>
            <div className="plan-selector">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`plan-option ${form.plan_id === String(n) ? 'selected' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, plan_id: String(n) }))}
                >
                  <div className="plan-option-name">{form[`plan_name${n}`] || `Plan ${n}`}</div>
                  <div className="plan-option-price">${form[`price_plan${n}`] || '0.00'}/mo</div>
                </div>
              ))}
            </div>
            {errors.plan_id && <div className="form-error" style={{ marginTop: 8 }}>{errors.plan_id}</div>}
          </div>

          <div className="signup-section">
            <h3>Admin User</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input className={`form-input ${errors.username ? 'error' : ''}`} value={form.username} onChange={set('username')} placeholder="admin_user" />
                {errors.username && <div className="form-error">{errors.username}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Admin Email *</label>
                <input type="email" className={`form-input ${errors.admin_email ? 'error' : ''}`} value={form.admin_email} onChange={set('admin_email')} placeholder="admin@company.com" />
                {errors.admin_email && <div className="form-error">{errors.admin_email}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="password" className={`form-input ${errors.password ? 'error' : ''}`} value={form.password} onChange={set('password')} placeholder="••••••" autoComplete="new-password" />
                {errors.password && <div className="form-error">{errors.password}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input type="password" className={`form-input ${errors.confirmPassword ? 'error' : ''}`} value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••" autoComplete="new-password" />
                {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Create Account'}
          </button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}