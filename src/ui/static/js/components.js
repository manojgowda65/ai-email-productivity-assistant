/**
 * UI Component builders for Gmail Clone
 */

const components = {
  /**
   * Escape HTML to prevent XSS in text nodes
   */
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Generate an avatar background color based on name/email string
   */
  getAvatarColor(str) {
    const colors = [
      'bg-red-500', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600',
      'bg-purple-600', 'bg-indigo-600', 'bg-pink-600', 'bg-teal-600'
    ];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  },

  /**
   * Render an individual email row in the list view
   */
  renderEmailRow(msg) {
    const isUnread = msg.isUnread;
    const isStarred = msg.isStarred;
    const senderName = this.escapeHtml(msg.sender?.name || msg.sender?.email || 'Unknown');
    const subject = this.escapeHtml(msg.subject || '(no subject)');
    const snippet = this.escapeHtml(msg.snippet || '');
    const dateStr = this.escapeHtml(msg.dateFormatted || '');

    return `
      <div class="email-row ${isUnread ? 'unread' : 'read'} flex items-center px-4 py-2.5 cursor-pointer group select-none text-sm"
           data-id="${msg.id}" data-thread-id="${msg.threadId}">
        
        <!-- Checkbox & Star -->
        <div class="flex items-center gap-3 pr-3 flex-shrink-0" onclick="event.stopPropagation();">
          <input type="checkbox" class="email-select-cb rounded border-gray-300 text-blue-600 focus:ring-0 cursor-pointer w-4 h-4" data-id="${msg.id}">
          <button class="star-btn ${isStarred ? 'starred' : 'text-gray-300 hover:text-gray-500'} transition-colors" data-id="${msg.id}" data-starred="${isStarred}">
            <svg class="w-4 h-4 stroke-current ${isStarred ? 'fill-amber-400 stroke-amber-400' : 'fill-none'}" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>

        <!-- Sender Column -->
        <div class="w-48 md:w-56 truncate pr-4 flex-shrink-0 text-gray-900 ${isUnread ? 'font-bold' : 'font-normal'}">
          ${senderName}
        </div>

        <!-- Subject & Snippet -->
        <div class="flex-1 truncate pr-4 text-gray-800">
          <span class="${isUnread ? 'font-semibold text-gray-900' : 'text-gray-800'}">${subject}</span>
          <span class="text-gray-500 font-normal"> - ${snippet}</span>
        </div>

        <!-- Date / Hover Actions -->
        <div class="w-24 text-right flex-shrink-0">
          <span class="row-date text-xs text-gray-500 font-medium">${dateStr}</span>
          <div class="row-actions items-center justify-end gap-2 text-gray-500" onclick="event.stopPropagation();">
            <button class="p-1 hover:text-gray-800 hover:bg-gray-200 rounded action-read-toggle" data-id="${msg.id}" data-unread="${isUnread}" title="${isUnread ? 'Mark as read' : 'Mark as unread'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isUnread ? 'M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5' : 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'}" />
              </svg>
            </button>
            <button class="p-1 hover:text-red-600 hover:bg-gray-200 rounded action-trash" data-id="${msg.id}" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    `;
  },

  /**
   * Render Loading Skeletons
   */
  renderSkeleton(count = 8) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="flex items-center px-4 py-3.5 border-b border-gray-100 animate-pulse bg-white">
          <div class="w-4 h-4 bg-gray-200 rounded mr-3"></div>
          <div class="w-4 h-4 bg-gray-200 rounded mr-6"></div>
          <div class="w-44 h-4 bg-gray-200 rounded mr-6"></div>
          <div class="flex-1 h-4 bg-gray-200 rounded mr-6"></div>
          <div class="w-16 h-4 bg-gray-200 rounded"></div>
        </div>
      `;
    }
    return html;
  },

  /**
   * Render Error state banner (e.g. Gmail API not yet enabled)
   */
  renderErrorState(errorMsg, isApiDisabled = false) {
    const projectUrl = "https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=email-assistant-514600";
    return `
      <div class="flex flex-col items-center justify-center py-16 text-center px-4 max-w-lg mx-auto">
        <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-200">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 class="text-base font-semibold text-gray-900 mb-2">
          ${isApiDisabled ? 'Gmail API Is Not Enabled Yet' : 'Unable to Load Emails'}
        </h3>
        <p class="text-sm text-gray-600 mb-6 leading-relaxed">
          ${this.escapeHtml(errorMsg)}
        </p>
        ${isApiDisabled ? `
          <div class="flex flex-col sm:flex-row items-center gap-3">
            <a href="${projectUrl}" target="_blank" rel="noopener noreferrer" 
               class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-full shadow-sm transition flex items-center gap-2">
              <span>Enable Gmail API in Google Cloud</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </a>
            <button onclick="window.location.reload();" 
                    class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-full transition">
              Refresh After Enabling
            </button>
          </div>
        ` : `
          <button onclick="window.location.reload();" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-full transition">
            Retry
          </button>
        `}
      </div>
    `;
  },

  /**
   * Render Empty state

   */
  renderEmptyState(title = "Your inbox is empty", subtitle = "No messages matched your query or folder.") {
    return `
      <div class="flex flex-col items-center justify-center py-20 text-center px-4">
        <div class="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 class="text-base font-medium text-gray-800 mb-1">${this.escapeHtml(title)}</h3>
        <p class="text-sm text-gray-500 max-w-sm">${this.escapeHtml(subtitle)}</p>
      </div>
    `;
  },

  /**
   * Render the full thread conversation view
   */
  renderThreadView(thread) {
    const subject = this.escapeHtml(thread.subject || '(no subject)');
    const messages = thread.messages || [];

    const messagesHtml = messages.map((msg, index) => {
      const senderName = this.escapeHtml(msg.sender?.name || msg.sender?.email || 'Unknown');
      const senderEmail = this.escapeHtml(msg.sender?.email || '');
      const initial = (senderName[0] || 'U').toUpperCase();
      const avatarColor = this.getAvatarColor(senderEmail || senderName);
      const recipient = this.escapeHtml(msg.recipient || 'me');
      const dateFormatted = this.escapeHtml(msg.dateFormatted || '');
      const bodyHtml = msg.bodyHtml || `<p class="whitespace-pre-wrap">${this.escapeHtml(msg.bodyText || '')}</p>`;
      
      const attachmentsHtml = (msg.attachments || []).map(att => `
        <div class="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 cursor-pointer border border-gray-200">
          <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span class="truncate max-w-xs">${this.escapeHtml(att.filename)}</span>
          <span class="text-gray-400">(${Math.round(att.size / 1024)} KB)</span>
        </div>
      `).join('');

      return `
        <div class="bg-white rounded-2xl border border-gray-200/90 shadow-sm mb-4 overflow-hidden" data-msg-id="${msg.id}">
          <!-- Message Header -->
          <div class="flex items-start justify-between p-5 pb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full ${avatarColor} text-white flex items-center justify-center font-medium text-sm flex-shrink-0 shadow-sm">
                ${initial}
              </div>
              <div>
                <div class="flex items-baseline gap-2">
                  <span class="font-medium text-gray-900 text-sm">${senderName}</span>
                  <span class="text-xs text-gray-400">&lt;${senderEmail}&gt;</span>
                </div>
                <div class="text-xs text-gray-500 mt-0.5">
                  to ${recipient}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 text-xs text-gray-500">
              <span>${dateFormatted}</span>
              <button class="text-gray-400 hover:text-gray-600 p-1 rounded" title="Reply">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Message Body Container -->
          <div class="px-5 py-4 text-sm text-gray-800 border-t border-gray-100 overflow-x-auto leading-relaxed">
            <iframe class="message-body-frame" srcdoc="${this.escapeHtml(bodyHtml)}" sandbox="allow-same-origin" onload="this.style.height = (this.contentWindow.document.body.scrollHeight + 30) + 'px';"></iframe>
          </div>

          <!-- Attachments Section (if any) -->
          ${attachmentsHtml ? `
            <div class="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex flex-wrap gap-2">
              ${attachmentsHtml}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="thread-detail-container max-w-5xl mx-auto px-4 py-4">
        
        <!-- Thread Header & Actions -->
        <div class="flex items-center justify-between pb-4 mb-4 border-b border-gray-200">
          <div class="flex items-center gap-3">
            <button id="btn-back-to-list" class="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition" title="Back to Inbox">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h2 class="google-sans text-xl font-medium text-gray-900 truncate max-w-2xl">${subject}</h2>
          </div>

          <div class="flex items-center gap-2 text-gray-600">
            <button class="p-2 hover:bg-gray-200 rounded-full" title="Delete thread" id="btn-thread-trash">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- AI Assistant Placeholder Banner (Ready for future Assistant hook) -->
        <div class="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-xs shadow-sm">
              ✨
            </div>
            <div>
              <span class="text-xs font-semibold text-blue-900">AI Assistant Ready</span>
              <p class="text-xs text-blue-700">Summaries, context-aware replies & approval flows will connect directly here.</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition shadow-xs" onclick="alert('AI Assistant hook is ready. Next phase will attach local LLM summarization!');">
              ⚡ Summarize Thread
            </button>
            <button class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-xs" onclick="alert('AI Assistant hook is ready. Next phase will draft a reply!');">
              ✍️ AI Draft Reply
            </button>
          </div>
        </div>

        <!-- Messages in Thread -->
        <div class="space-y-3">
          ${messagesHtml}
        </div>

        <!-- Bottom Quick Reply Box -->
        <div class="mt-6 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium">
              Me
            </div>
            <span class="text-xs text-gray-500">Reply to conversation</span>
          </div>
          <textarea id="reply-textarea" class="w-full text-sm border-0 focus:ring-0 resize-none h-20 text-gray-800 placeholder-gray-400" placeholder="Type your reply here or use AI Draft..."></textarea>
          <div class="flex items-center justify-between pt-2 border-t border-gray-100">
            <div class="flex items-center gap-2">
              <button class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-medium shadow-sm transition" onclick="alert('Reply capability will link with Google Send API & AI Approval in the next phase.');">
                Send
              </button>
              <button class="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-full transition" onclick="alert('Generate draft with AI...');">
                ✨ Draft with AI
              </button>
            </div>
            <span class="text-xs text-gray-400">Human approval required</span>
          </div>
        </div>

      </div>
    `;
  }
};

