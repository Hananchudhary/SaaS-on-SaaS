import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../ToastContext';
import api from '../api';

const initialForm = {
  company_name: '', email: '', phone: '', address: '',
  plan_name1: '', tier1_users_plan1: '5', tier2_users_plan1: '2', tier3_users_plan1: '1', price_plan1: '49.99',
  plan_name2: '', tier1_users_plan2: '20', tier2_users_plan2: '10', tier3_users_plan2: '5', price_plan2: '99.99',
  plan_name3: '', tier1_users_plan3: '100', tier2_users_plan3: '50', tier3_users_plan3: '25', price_plan3: '299.99',
  plan_id: '',
  username: '', admin_email: '', password: '', confirmPassword: '',
  otp_company: '', otp_admin: '',
};

// System plan names for selection (these are fixed - user subscribes to system plans 1, 2, or 3)
const DEFAULT_SYSTEM_PLANS = [
  { id: 1, name: 'Basic', price: 49.99, description: 'Entry-level plan for small businesses' },
  { id: 2, name: 'Professional', price: 99.99, description: 'Mid-tier plan with more features' },
  { id: 3, name: 'Enterprise', price: 299.99, description: 'Full-featured plan for large organizations' },
];

const PlanFields = ({ n, label, form, errors, handleChange }) => (
  <div className="signup-section">
    <h3>{label}</h3>
    <div className="form-group">
      <label className="form-label">Plan Name</label>
      <input 
        className={`form-input ${errors[`plan_name${n}`] ? 'error' : ''}`} 
        value={form[`plan_name${n}`]} 
        onChange={(e) => handleChange(`plan_name${n}`, e.target.value)} 
        placeholder={`Plan ${n} name`} 
      />
      {errors[`plan_name${n}`] && <div className="form-error">{errors[`plan_name${n}`]}</div>}
    </div>
    <div className="form-row-3">
      <div className="form-group">
        <label className="form-label">Tier 1 Users</label>
        <input 
          type="number" 
          min="0" 
          className={`form-input ${errors[`tier1_users_plan${n}`] ? 'error' : ''}`} 
          value={form[`tier1_users_plan${n}`]} 
          onChange={(e) => handleChange(`tier1_users_plan${n}`, e.target.value)} 
        />
        {errors[`tier1_users_plan${n}`] && <div className="form-error">{errors[`tier1_users_plan${n}`]}</div>}
      </div>
      <div className="form-group">
        <label className="form-label">Tier 2 Users</label>
        <input 
          type="number" 
          min="0" 
          className={`form-input ${errors[`tier2_users_plan${n}`] ? 'error' : ''}`} 
          value={form[`tier2_users_plan${n}`]} 
          onChange={(e) => handleChange(`tier2_users_plan${n}`, e.target.value)} 
        />
        {errors[`tier2_users_plan${n}`] && <div className="form-error">{errors[`tier2_users_plan${n}`]}</div>}
      </div>
      <div className="form-group">
        <label className="form-label">Tier 3 Users</label>
        <input 
          type="number" 
          min="0" 
          className={`form-input ${errors[`tier3_users_plan${n}`] ? 'error' : ''}`} 
          value={form[`tier3_users_plan${n}`]} 
          onChange={(e) => handleChange(`tier3_users_plan${n}`, e.target.value)} 
        />
        {errors[`tier3_users_plan${n}`] && <div className="form-error">{errors[`tier3_users_plan${n}`]}</div>}
      </div>
    </div>
    <div className="form-group">
      <label className="form-label">Monthly Price ($)</label>
      <input 
        type="number" 
        step="0.01" 
        min="0" 
        className={`form-input ${errors[`price_plan${n}`] ? 'error' : ''}`} 
        value={form[`price_plan${n}`]} 
        onChange={(e) => handleChange(`price_plan${n}`, e.target.value)} 
        placeholder="0.00" 
      />
      {errors[`price_plan${n}`] && <div className="form-error">{errors[`price_plan${n}`]}</div>}
    </div>
  </div>
);

export default function Signup() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [errors, setErrors] = useState({});
  const [systemPlans, setSystemPlans] = useState(DEFAULT_SYSTEM_PLANS);
  const [otpSent, setOtpSent] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [adminEmailTouched, setAdminEmailTouched] = useState(false);
  const emailPattern = /\S+@\S+\.\S+/;
  const emailInvalid = emailTouched && form.email.length > 0 && !emailPattern.test(form.email);
  const adminEmailInvalid = adminEmailTouched && form.admin_email.length > 0 && !emailPattern.test(form.admin_email);

  useEffect(() => {
    let isMounted = true;

    const normalizePlans = (plans) => plans.slice(0, 3).map((plan, index) => ({
      id: index + 1,
      name: plan.name,
      price: plan.price,
      description: plan.description || '',
      tier_1_users: plan.tier_1_users,
      tier_2_users: plan.tier_2_users,
      tier_3_users: plan.tier_3_users,
    }));

    const applyPlansToForm = (plans) => {
      setForm((f) => {
        const next = { ...f };
        plans.forEach((plan, index) => {
          const n = index + 1;
          if (plan.name) next[`plan_name${n}`] = plan.name;
          if (plan.tier_1_users !== undefined) next[`tier1_users_plan${n}`] = String(plan.tier_1_users);
          if (plan.tier_2_users !== undefined) next[`tier2_users_plan${n}`] = String(plan.tier_2_users);
          if (plan.tier_3_users !== undefined) next[`tier3_users_plan${n}`] = String(plan.tier_3_users);
          if (plan.price !== undefined) next[`price_plan${n}`] = String(plan.price);
        });
        return next;
      });
    };

    const loadPlans = async () => {
      try {
        const response = await api.get('/system-plans');
        const plans = normalizePlans(response.data?.data?.plans || []);
        if (plans.length > 0 && isMounted) {
          setSystemPlans(plans);
          applyPlansToForm(plans);
        }
      } catch (err) {
        // Keep defaults if the config endpoint is unavailable.
      }
    };

    loadPlans();
    return () => {
      isMounted = false;
    };
  }, []);

  // Use useCallback to create stable handler references
  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

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
    if (!form.otp_company.trim()) errs.otp_company = 'Required';
    if (!form.otp_admin.trim()) errs.otp_admin = 'Required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      // plan_id should be the system plan ID (1, 2, or 3)
      payload.plan_id = parseInt(payload.plan_id, 10);
      payload.otp_company = String(payload.otp_company || '').trim();
      payload.otp_admin = String(payload.otp_admin || '').trim();
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

  const requestOtp = async () => {
    if (!form.email.trim() || !form.admin_email.trim()) {
      showToast('Enter both company email and admin email to receive OTPs', 'warning');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(form.email) || !/\S+@\S+\.\S+/.test(form.admin_email)) {
      showToast('Please enter valid company and admin emails', 'warning');
      return;
    }
    setOtpSending(true);
    try {
      const res = await api.post('/signup/request-otp', {
        company_email: form.email,
        admin_email: form.admin_email,
      });
      setOtpSent(true);
      showToast('OTPs sent to both emails', 'success');
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to send OTPs';
      showToast(msg, 'error');
    } finally {
      setOtpSending(false);
    }
  };

  // Extract plan name from form dynamically based on the selected system plan ID
  const getPlanNameForSelection = (systemPlanId) => {
    const plan = systemPlans.find((item) => item.id === systemPlanId);
    return plan?.name || '';
  };

  const getPlanPriceForSelection = (systemPlanId) => {
    const plan = systemPlans.find((item) => item.id === systemPlanId);
    return plan?.price ?? 0;
  };


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
                <input 
                  className={`form-input ${errors.company_name ? 'error' : ''}`} 
                  value={form.company_name} 
                  onChange={(e) => handleChange('company_name', e.target.value)} 
                  placeholder="Your Company" 
                />
                {errors.company_name && <div className="form-error">{errors.company_name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Company Email *</label>
                <input 
                  type="email" 
                  className={`form-input ${(errors.email || emailInvalid) ? 'error' : ''}`} 
                  value={form.email} 
                  onChange={(e) => {
                    if (!emailTouched) setEmailTouched(true);
                    handleChange('email', e.target.value);
                  }} 
                  placeholder="info@company.com" 
                />
                {emailInvalid && <div className="form-error">Invalid email</div>}
                {errors.email && <div className="form-error">{errors.email}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input 
                  className="form-input" 
                  value={form.phone} 
                  onChange={(e) => handleChange('phone', e.target.value)} 
                  placeholder="+1-555-0100" 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input 
                  className="form-input" 
                  value={form.address} 
                  onChange={(e) => handleChange('address', e.target.value)} 
                  placeholder="123 Main St" 
                />
              </div>
            </div>
          </div>

          <PlanFields n={1} label={`Plan 1 — ${systemPlans[0]?.name || 'Basic'}`} form={form} errors={errors} handleChange={handleChange} />
          <PlanFields n={2} label={`Plan 2 — ${systemPlans[1]?.name || 'Professional'}`} form={form} errors={errors} handleChange={handleChange} />
          <PlanFields n={3} label={`Plan 3 — ${systemPlans[2]?.name || 'Enterprise'}`} form={form} errors={errors} handleChange={handleChange} />

          <div className="signup-section">
            <h3>Select System Subscription Plan</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Choose which system plan to subscribe to. Your company will be billed according to this plan.
            </p>
            <div className="plan-selector">
              {systemPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`plan-option ${form.plan_id === String(plan.id) ? 'selected' : ''}`}
                  onClick={() => handleChange('plan_id', String(plan.id))}
                >
                  <div className="plan-option-name">{getPlanNameForSelection(plan.id)}</div>
                  <div className="plan-option-price">${getPlanPriceForSelection(plan.id)}/mo</div>
                  <div className="plan-option-desc">{plan.description}</div>
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
                <input 
                  className={`form-input ${errors.username ? 'error' : ''}`} 
                  value={form.username} 
                  onChange={(e) => handleChange('username', e.target.value)} 
                  placeholder="admin_user" 
                />
                {errors.username && <div className="form-error">{errors.username}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Admin Email *</label>
                <input 
                  type="email" 
                  className={`form-input ${(errors.admin_email || adminEmailInvalid) ? 'error' : ''}`} 
                  value={form.admin_email} 
                  onChange={(e) => {
                    if (!adminEmailTouched) setAdminEmailTouched(true);
                    handleChange('admin_email', e.target.value);
                  }} 
                  placeholder="admin@company.com" 
                />
                {adminEmailInvalid && <div className="form-error">Invalid email</div>}
                {errors.admin_email && <div className="form-error">{errors.admin_email}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input 
                  type="password" 
                  className={`form-input ${errors.password ? 'error' : ''}`} 
                  value={form.password} 
                  onChange={(e) => handleChange('password', e.target.value)} 
                  placeholder="••••••" 
                  autoComplete="new-password" 
                />
                {errors.password && <div className="form-error">{errors.password}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input 
                  type="password" 
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`} 
                  value={form.confirmPassword} 
                  onChange={(e) => handleChange('confirmPassword', e.target.value)} 
                  placeholder="••••••" 
                  autoComplete="new-password" 
                />
                {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
              </div>
            </div>
          </div>

          <div className="signup-section">
            <h3>Verify Emails</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Send OTPs to both company and admin emails, then enter them below to complete signup.
            </p>
            <div className="form-row" style={{ alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Company Email OTP *</label>
                <input
                  className={`form-input ${errors.otp_company ? 'error' : ''}`}
                  value={form.otp_company}
                  onChange={(e) => handleChange('otp_company', e.target.value)}
                  placeholder="Enter company OTP"
                />
                {errors.otp_company && <div className="form-error">{errors.otp_company}</div>}
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Admin Email OTP *</label>
                <input
                  className={`form-input ${errors.otp_admin ? 'error' : ''}`}
                  value={form.otp_admin}
                  onChange={(e) => handleChange('otp_admin', e.target.value)}
                  placeholder="Enter admin OTP"
                />
                {errors.otp_admin && <div className="form-error">{errors.otp_admin}</div>}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={requestOtp}
                disabled={otpSending}
                style={{ height: 42, whiteSpace: 'nowrap' }}
              >
                {otpSending ? 'Sending...' : otpSent ? 'Resend OTPs' : 'Send OTPs'}
              </button>
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
