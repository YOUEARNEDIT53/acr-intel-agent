'use client';

import { useState, useEffect } from 'react';

interface Recipient {
  email: string;
  id: string;
}

export default function SettingsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current recipients
  useEffect(() => {
    async function loadRecipients() {
      try {
        const res = await fetch('/api/settings?key=digest_recipients');
        const data = await res.json();
        const emailString = data.value || '';
        const emails = emailString
          .split(',')
          .map((e: string) => e.trim())
          .filter((e: string) => e)
          .map((email: string) => ({ email, id: crypto.randomUUID() }));
        setRecipients(emails);
      } catch (error) {
        console.error('Failed to load recipients:', error);
        setMessage({ type: 'error', text: 'Failed to load recipients' });
      } finally {
        setLoading(false);
      }
    }
    loadRecipients();
  }, []);

  // Save recipients to database
  async function saveRecipients(updatedRecipients: Recipient[]) {
    setSaving(true);
    setMessage(null);
    try {
      const value = updatedRecipients.map((r) => r.email).join(',');
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'digest_recipients', value }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Recipients saved successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save recipients' });
    } finally {
      setSaving(false);
    }
  }

  // Add new recipient
  function handleAddRecipient(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    // Check for duplicates
    if (recipients.some((r) => r.email.toLowerCase() === email)) {
      setMessage({ type: 'error', text: 'This email is already in the list' });
      return;
    }

    const updated = [...recipients, { email, id: crypto.randomUUID() }];
    setRecipients(updated);
    setNewEmail('');
    saveRecipients(updated);
  }

  // Remove recipient
  function handleRemoveRecipient(id: string) {
    const updated = recipients.filter((r) => r.id !== id);
    setRecipients(updated);
    saveRecipients(updated);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-8">
        Manage your podcast and digest distribution settings.
      </p>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Distribution List Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Email Distribution List
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            These addresses receive the daily digest and podcast emails.
          </p>
        </div>

        <div className="p-6">
          {/* Add new recipient form */}
          <form onSubmit={handleAddRecipient} className="mb-6">
            <div className="flex gap-3">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={saving || !newEmail.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Add
              </button>
            </div>
          </form>

          {/* Recipients list */}
          <div className="space-y-2">
            {recipients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No recipients configured. Add an email address above.
              </p>
            ) : (
              recipients.map((recipient) => (
                <div
                  key={recipient.id}
                  className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg group"
                >
                  <span className="text-gray-700">{recipient.email}</span>
                  <button
                    onClick={() => handleRemoveRecipient(recipient.id)}
                    disabled={saving}
                    className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    title="Remove recipient"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Count */}
          {recipients.length > 0 && (
            <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-200">
              {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} configured
            </p>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-1">
          How it works
        </h3>
        <p className="text-sm text-blue-700">
          Changes are saved automatically. All recipients will receive the daily
          digest email and podcast episodes. The podcast is generated 3 times
          daily (8am, 2pm, 8pm UTC).
        </p>
      </div>
    </div>
  );
}
