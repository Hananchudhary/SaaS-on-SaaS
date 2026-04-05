import { useState } from 'react';
import api from '../api';
import { useToast } from '../ToastContext';

export default function Settings() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();
  const passwordsMismatch =
    confirmTouched &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('All fields are required', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (res.data.success) {
        showToast('Password updated successfully', 'success');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(res.data.error?.message || 'Failed to update password', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'An error occurred';
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="section-header">
        <h2>Settings</h2>
        <p>Manage your account settings and security</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>
          Change Password
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="oldPassword">Current Password</label>
            <input
              type="password"
              id="oldPassword"
              className="form-input"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter current password"
              disabled={isLoading}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              className={`form-input ${passwordsMismatch ? 'error' : ''}`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              disabled={isLoading}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              className={`form-input ${passwordsMismatch ? 'error' : ''}`}
              value={confirmPassword}
              onChange={(e) => {
                if (!confirmTouched) setConfirmTouched(true);
                setConfirmPassword(e.target.value);
              }}
              placeholder="Confirm new password"
              disabled={isLoading}
              required
            />
            {passwordsMismatch && (
              <div className="form-error">New passwords do not match</div>
            )}
          </div>
          
          <div style={{ marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: 'auto' }}
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
