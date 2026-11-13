/**
 * API client for interacting with the backend Flask endpoints.
 */
const api = {
  async getProfile() {
    try {
      const res = await fetch('/api/user');
        const data = await res.json();
        if (!res.ok) {
          return { error: data.error || 'Failed to load profile', apiDisabled: data.apiDisabled };
        }
        return data;
      } catch (err) {
        console.error('Error fetching profile:', err);
        return { error: err.message };
      }
    },

  async getLabels() {
      try {
        const res = await fetch('/api/labels');
        const data = await res.json();
        return data.labels || {};
      } catch (err) {
        console.error('Error fetching labels:', err);
        return {};
      }
    },

  async getMessages(folder = 'INBOX', query = '', pageToken = null) {
      try {
        const params = new URLSearchParams();
        if (folder) params.append('folder', folder);
        if (query) params.append('q', query);
        if (pageToken) params.append('pageToken', pageToken);

        const res = await fetch(`/api/messages?${params.toString()}`);
          const data = await res.json();
          if (!res.ok || data.error) {
            return { messages: [], error: data.error || 'Failed to load messages', apiDisabled: data.apiDisabled };
          }
          return data;
        } catch (err) {
          console.error('Error fetching messages:', err);
          return { messages: [], error: err.message };
        }
      },

  async getThread(threadId) {
        try {
          const res = await fetch(`/api/threads/${threadId}`);
          return await res.json();
        } catch (err) {
          console.error('Error fetching thread:', err);
          return { error: err.message };
        }
      },

  async messageAction(messageId, action) {
        try {
          const res = await fetch(`/api/messages/${messageId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
          });
          return await res.json();
        } catch (err) {
          console.error(`Error performing action ${action} on message ${messageId}:`, err);
          return { error: err.message };
        }
      }
    };
