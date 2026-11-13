import os
import sys
from pathlib import Path
from flask import Flask, request, jsonify, redirect, render_template, url_for, session
from flask_cors import CORS
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from src.api.auth import (
        is_authenticated,
        get_authorization_url,
        exchange_code,
        clear_credentials,
        get_credentials
    )
    from src.api.gmail_service import (
        get_user_profile,
        get_labels,
        list_messages,
        get_thread_details,
        modify_message,
        trash_message,
        untrash_message
    )
except ImportError:
    from auth import (
        is_authenticated,
        get_authorization_url,
        exchange_code,
        clear_credentials,
        get_credentials
    )
    from gmail_service import (
        get_user_profile,
        get_labels,
        list_messages,
        get_thread_details,
        modify_message,
        trash_message,
        untrash_message
    )


# Load environment variables
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UI_DIR = BASE_DIR / 'src' / 'ui'
TEMPLATE_DIR = UI_DIR / 'templates'
STATIC_DIR = UI_DIR / 'static'

app = Flask(
    __name__,
    template_folder=str(TEMPLATE_DIR),
    static_folder=str(STATIC_DIR),
    static_url_path='/static'
)

app.secret_key = os.getenv('FLASK_SECRET_KEY', 'gmail-clone-local-dev-secret-key-3.12')
CORS(app)


# ----------------- Web / UI Routes -----------------

@app.route('/')
def index():
    """Main application shell."""
    if not is_authenticated():
        return render_template('login.html')
    return render_template('index.html')


@app.route('/home')
def oauth_callback():
    """
    OAuth 2.0 redirect endpoint matching Google Cloud Credentials:
    http://localhost:5000/home
    """
    code = request.args.get('code')
    state = request.args.get('state') or session.get('oauth_state')
    error = request.args.get('error')

    if error:
        return render_template('login.html', error=f"Google Authentication Error: {error}")

    if code:
        try:
            code_verifier = session.get('code_verifier')
            exchange_code(code=code, state=state, code_verifier=code_verifier)
            return redirect(url_for('index'))
        except Exception as e:
            return render_template('login.html', error=f"Failed to authenticate: {str(e)}")

    # If accessed directly without code, redirect to root
    return redirect(url_for('index'))


# ----------------- Auth API Routes -----------------

@app.route('/auth/login')
def login():
    """Redirect user to Google OAuth consent page."""
    auth_url, state, code_verifier = get_authorization_url()
    session['oauth_state'] = state
    session['code_verifier'] = code_verifier
    return redirect(auth_url)



@app.route('/auth/status')
def auth_status():
    """Check if server has valid Gmail access."""
    authenticated = is_authenticated()
    user_info = get_user_profile() if authenticated else None
    return jsonify({
        "authenticated": authenticated,
        "user": user_info
    })


@app.route('/auth/logout')
def logout():
    """Clear credentials and redirect to login."""
    clear_credentials()
    session.clear()
    return redirect(url_for('index'))


# ----------------- Gmail Data API Routes -----------------

@app.route('/api/user')
def api_user():
    """Get authenticated user profile."""
    if not is_authenticated():
        return jsonify({"error": "Not authenticated"}), 401
    profile = get_user_profile()
    if profile and profile.get("apiDisabled"):
        return jsonify(profile), 503
    return jsonify(profile)



@app.route('/api/labels')
def api_labels():
    """Get Gmail system labels and unread counters."""
    labels = get_labels()
    return jsonify({"labels": labels})


@app.route('/api/messages')
def api_messages():
    """
    Fetch paginated messages list for a folder or search query.
    Params:
      folder: INBOX (default), STARRED, SENT, DRAFT, TRASH, SPAM
      q: custom search query
      pageToken: page token for pagination
      maxResults: count (default 25)
    """
    folder = request.args.get('folder', 'INBOX')
    query = request.args.get('q', '')
    page_token = request.args.get('pageToken', None)
    max_results = int(request.args.get('maxResults', 25))

    data = list_messages(
        folder=folder,
        query=query,
        page_token=page_token,
        max_results=max_results
    )
    return jsonify(data)


@app.route('/api/threads/<thread_id>')
def api_thread(thread_id):
    """Get full conversation thread details with HTML body."""
    data = get_thread_details(thread_id)
    if "error" in data:
        return jsonify(data), 400
    return jsonify(data)


@app.route('/api/messages/<message_id>/action', methods=['POST'])
def api_message_action(message_id):
    """
    Modify email status: star, unstar, mark-read, mark-unread, trash, untrash.
    Payload: { "action": "star" | "unstar" | "read" | "unread" | "trash" | "untrash" }
    """
    body = request.get_json() or {}
    action = body.get('action')

    if action == 'star':
        res = modify_message(message_id, add_labels=['STARRED'])
    elif action == 'unstar':
        res = modify_message(message_id, remove_labels=['STARRED'])
    elif action == 'read':
        res = modify_message(message_id, remove_labels=['UNREAD'])
    elif action == 'unread':
        res = modify_message(message_id, add_labels=['UNREAD'])
    elif action == 'trash':
        res = trash_message(message_id)
    elif action == 'untrash':
        res = untrash_message(message_id)
    else:
        return jsonify({"error": f"Unknown action: {action}"}), 400

    return jsonify(res)


# ----------------- Main Entrypoint -----------------

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"\n🚀 Starting Gmail Clone Server on http://localhost:{port} (matches OAuth redirect URI)\n")
    app.run(host='0.0.0.0', port=port, debug=True)

