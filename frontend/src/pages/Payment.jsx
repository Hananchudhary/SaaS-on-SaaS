import { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../ToastContext';
import { useAuth } from '../AuthContext';

export default function Payment() {
  const { setWarning } = useAuth();
  const { showToast } = useToast();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');

  const fetchBilling = async () => {
    setLoading(true);
    try {
      const res = await api.get('/pay');
      setBilling(res.data);
      const total = (res.data.plan_amount || 0) + (res.data.overdue_fine || 0);
      setAmount(total.toFixed(2));
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to load billing info';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Please enter a valid amount', 'warning');
      return;
    }
    setPaying(true);
    try {
      await api.post('/pay', { payment_amount: parseFloat(amount) });
      showToast('Payment processed successfully! Editor access has been re-enabled.', 'success');
      setWarning(null);
      fetchBilling();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Payment failed';
      showToast(msg, 'error');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading billing info...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Payment</h2>
        <p>Manage your billing and payments</p>
      </div>

      {billing ? (
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-header">
            <h3 className="card-title">Current Billing</h3>
          </div>

          <div className="payment-summary">
            <div className="payment-item">
              <div className="label">Plan Amount</div>
              <div className="amount">${billing.plan_amount?.toFixed(2) || '0.00'}</div>
            </div>
            <div className="payment-item">
              <div className="label">Overdue Fine</div>
              <div className={`amount ${billing.overdue_fine > 0 ? 'overdue-amount' : ''}`}>
                ${billing.overdue_fine?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>

          {billing.overdue_fine > 0 && (
            <div className="alert alert-warning" style={{ marginBottom: 20 }}>
              <span>⚠</span>
              <div>
                You have an overdue fine of <strong>${billing.overdue_fine.toFixed(2)}</strong>.
                Pay to re-enable SQL editor access.
              </div>
            </div>
          )}

          <form onSubmit={handlePayment}>
            <div className="form-group">
              <label className="form-label">Payment Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <button type="submit" className="btn btn-success" style={{ width: '100%' }} disabled={paying}>
              {paying ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Processing...</> : '💳 Process Payment'}
            </button>
          </form>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">💳</div>
            <p>No billing information available</p>
          </div>
        </div>
      )}
    </>
  );
}
