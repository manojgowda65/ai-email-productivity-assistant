/**
 * Main Application Controller for Gmail Clone
 */

const app = {
  state: {
    currentFolder: 'INBOX',
    searchQuery: '',
    pageToken: null,
    pageTokenHistory: [],
    messages: [],
    labels: {},
    user: null,
    selectedThreadId: null,
    selectedMessageIds: new Set(),
    resultSizeEstimate: 0
  },

  async init() {
    this.setupEventListeners();
    await this.loadUserProfile();
    await this.loadLabels();
    await this.loadEmails();
  },

  setupEventListeners() {
    // Sidebar Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const folder = item.dataset.folder;
        if (folder) {
          this.switchFolder(folder);
        }
      });
    });

    // Search Input
    const searchInput = document.getElementById('search-input');
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.performSearch(searchInput.value.trim());
      });
    }

    // Refresh Button
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadLabels();
        this.loadEmails();
      });
    }

    // Select All Checkbox
    const selectAllCb = document.getElementById('select-all-cb');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.email-select-cb').forEach(cb => {
          cb.checked = checked;
          const id = cb.dataset.id;
          if (checked) {
            this.state.selectedMessageIds.add(id);
          } else {
            this.state.selectedMessageIds.delete(id);
          }
        });
        this.updateActionToolbar();
      });
    }

    // Batch Actions
    const btnBatchRead = document.getElementById('btn-batch-read');
    if (btnBatchRead) {
      btnBatchRead.addEventListener('click', () => this.handleBatchAction('read'));
    }
    const btnBatchTrash = document.getElementById('btn-batch-trash');
    if (btnBatchTrash) {
      btnBatchTrash.addEventListener('click', () => this.handleBatchAction('trash'));
    }

    // Pagination
    const btnNextPage = document.getElementById('btn-next-page');
    if (btnNextPage) {
      btnNextPage.addEventListener('click', () => {
        if (this.state.nextPageToken) {
          this.state.pageTokenHistory.push(this.state.pageToken);
          this.state.pageToken = this.state.nextPageToken;
          this.loadEmails();
        }
      });
    }

    const btnPrevPage = document.getElementById('btn-prev-page');
    if (btnPrevPage) {
      btnPrevPage.addEventListener('click', () => {
        if (this.state.pageTokenHistory.length > 0) {
          this.state.pageToken = this.state.pageTokenHistory.pop();
          this.loadEmails();
        }
      });
    }

    // Sidebar Toggle (Hamburger)
    const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (btnSidebarToggle && sidebar) {
      btnSidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
      });
    }
  },

  async loadUserProfile() {
    const user = await api.getProfile();
      if (user && user.emailAddress) {
        this.state.user = user;
        const userEmailEl = document.getElementById('user-email');
        const userAvatarEl = document.getElementById('user-avatar');
        if (userEmailEl) userEmailEl.textContent = user.emailAddress;
        if (userAvatarEl) {
          userAvatarEl.textContent = (user.emailAddress[0] || 'U').toUpperCase();
          userAvatarEl.className = `w-8 h-8 rounded-full ${components.getAvatarColor(user.emailAddress)} text-white flex items-center justify-center font-semibold text-xs shadow-sm`;
        }
      }
    },

  async loadLabels() {
      const labels = await api.getLabels();
      this.state.labels = labels;

      // Update unread count badges in sidebar
      Object.keys(labels).forEach(labelId => {
        const badge = document.querySelector(`.badge-${labelId.toLowerCase()}`);
        if (badge) {
          const count = labels[labelId].threadsUnread || labels[labelId].messagesUnread || 0;
          if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
          } else {
            badge.classList.add('hidden');
          }
        }
      });
    },

    switchFolder(folder) {
      this.state.currentFolder = folder;
      this.state.searchQuery = '';
      this.state.pageToken = null;
      this.state.pageTokenHistory = [];
      this.state.selectedThreadId = null;
      this.state.selectedMessageIds.clear();

      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';

      // Update active nav styling
      document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.folder === folder) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      this.loadEmails();
    },

    performSearch(query) {
      this.state.searchQuery = query;
      this.state.pageToken = null;
      this.state.pageTokenHistory = [];
      this.state.selectedThreadId = null;
      this.loadEmails();
    },

  async loadEmails() {
      const emailListContainer = document.getElementById('email-list-content');
      const threadViewContainer = document.getElementById('thread-view-container');
      const emailListWrapper = document.getElementById('email-list-wrapper');

      // Switch view back to list
      if (threadViewContainer) threadViewContainer.classList.add('hidden');
      if (emailListWrapper) emailListWrapper.classList.remove('hidden');

      if (emailListContainer) {
        emailListContainer.innerHTML = components.renderSkeleton(10);
      }

      const data = await api.getMessages(
        this.state.currentFolder,
        this.state.searchQuery,
        this.state.pageToken
      );

      if (data.error) {
        if (emailListContainer) {
          emailListContainer.innerHTML = components.renderErrorState(data.error, data.apiDisabled);
        }
        return;
      }

      this.state.messages = data.messages || [];

      this.state.nextPageToken = data.nextPageToken || null;
      this.state.resultSizeEstimate = data.resultSizeEstimate || this.state.messages.length;

      this.renderEmailList();
      this.updatePaginationUI();
    },

    renderEmailList() {
      const emailListContainer = document.getElementById('email-list-content');
      if (!emailListContainer) return;

      if (this.state.messages.length === 0) {
        emailListContainer.innerHTML = components.renderEmptyState(
          this.state.searchQuery ? "No matches found" : `No messages in ${this.state.currentFolder}`,
          this.state.searchQuery ? "Try searching for a different keyword or email address." : "Your messages will appear here once received."
        );
        return;
      }

      emailListContainer.innerHTML = this.state.messages
        .map(msg => components.renderEmailRow(msg))
        .join('');

      this.attachEmailRowEvents();
    },

    attachEmailRowEvents() {
      const emailListContainer = document.getElementById('email-list-content');
      if (!emailListContainer) return;

      // Row Click -> Open Thread
      emailListContainer.querySelectorAll('.email-row').forEach(row => {
        row.addEventListener('click', () => {
          const threadId = row.dataset.threadId;
          if (threadId) {
            this.openThread(threadId);
          }
        });
      });

      // Checkbox Click
      emailListContainer.querySelectorAll('.email-select-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const id = cb.dataset.id;
          if (cb.checked) {
            this.state.selectedMessageIds.add(id);
          } else {
            this.state.selectedMessageIds.delete(id);
          }
          this.updateActionToolbar();
        });
      });

      // Star Click
      emailListContainer.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const isStarred = btn.dataset.starred === 'true';
          const action = isStarred ? 'unstar' : 'star';

          btn.dataset.starred = (!isStarred).toString();
          const svg = btn.querySelector('svg');
          if (!isStarred) {
            btn.classList.add('starred');
            svg.classList.add('fill-amber-400', 'stroke-amber-400');
            svg.classList.remove('fill-none');
          } else {
            btn.classList.remove('starred');
            svg.classList.remove('fill-amber-400', 'stroke-amber-400');
            svg.classList.add('fill-none');
          }

          await api.messageAction(id, action);
        });
      });

      // Hover Mark Read/Unread
      emailListContainer.querySelectorAll('.action-read-toggle').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const isUnread = btn.dataset.unread === 'true';
          const action = isUnread ? 'read' : 'unread';
          await api.messageAction(id, action);
          this.loadLabels();
          this.loadEmails();
        });
      });

      // Hover Trash
      emailListContainer.querySelectorAll('.action-trash').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          await api.messageAction(id, 'trash');
          this.loadLabels();
          this.loadEmails();
        });
      });
    },

  async openThread(threadId) {
      this.state.selectedThreadId = threadId;
      const emailListWrapper = document.getElementById('email-list-wrapper');
      const threadViewContainer = document.getElementById('thread-view-container');

      if (emailListWrapper) emailListWrapper.classList.add('hidden');
      if (threadViewContainer) {
        threadViewContainer.classList.remove('hidden');
        threadViewContainer.innerHTML = components.renderSkeleton(5);
      }

      const threadData = await api.getThread(threadId);
      if (threadData.error) {
        alert(`Error loading thread: ${threadData.error}`);
        this.switchFolder(this.state.currentFolder);
        return;
      }

      if (threadViewContainer) {
        threadViewContainer.innerHTML = components.renderThreadView(threadData);

        // Hook up Back Button
        const backBtn = document.getElementById('btn-back-to-list');
        if (backBtn) {
          backBtn.addEventListener('click', () => {
            this.state.selectedThreadId = null;
            threadViewContainer.classList.add('hidden');
            emailListWrapper.classList.remove('hidden');
          });
        }

        // Hook up Thread Trash
        const trashBtn = document.getElementById('btn-thread-trash');
        if (trashBtn && threadData.messages?.length > 0) {
          trashBtn.addEventListener('click', async () => {
            for (const m of threadData.messages) {
              await api.messageAction(m.id, 'trash');
            }
            this.loadLabels();
            this.switchFolder(this.state.currentFolder);
          });
        }
      }
    },

    updateActionToolbar() {
      const selectedCount = this.state.selectedMessageIds.size;
      const batchActions = document.getElementById('batch-actions');
      const normalActions = document.getElementById('normal-actions');

      if (selectedCount > 0) {
        if (batchActions) batchActions.classList.remove('hidden');
        if (normalActions) normalActions.classList.add('hidden');
      } else {
        if (batchActions) batchActions.classList.add('hidden');
        if (normalActions) normalActions.classList.remove('hidden');
      }
    },

  async handleBatchAction(action) {
      const ids = Array.from(this.state.selectedMessageIds);
      for (const id of ids) {
        await api.messageAction(id, action);
      }
      this.state.selectedMessageIds.clear();
      const selectAllCb = document.getElementById('select-all-cb');
      if (selectAllCb) selectAllCb.checked = false;
      this.updateActionToolbar();
      this.loadLabels();
      this.loadEmails();
    },

    updatePaginationUI() {
      const countEl = document.getElementById('pagination-count');
      const btnNext = document.getElementById('btn-next-page');
      const btnPrev = document.getElementById('btn-prev-page');

      const total = this.state.resultSizeEstimate || this.state.messages.length;
      const currentCount = this.state.messages.length;

      if (countEl) {
        countEl.textContent = currentCount > 0 ? `1-${currentCount} of ${total}` : '0 of 0';
      }

      if (btnNext) {
        btnNext.disabled = !this.state.nextPageToken;
        btnNext.classList.toggle('opacity-30', !this.state.nextPageToken);
      }

      if (btnPrev) {
        const hasPrev = this.state.pageTokenHistory.length > 0;
        btnPrev.disabled = !hasPrev;
        btnPrev.classList.toggle('opacity-30', !hasPrev);
      }
    }
  };

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });

