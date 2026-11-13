import os
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

# Allow HTTP for local OAuth callback testing
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Scopes needed for reading emails, modifying labels (read/unread, star, trash), and drafting
SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CREDENTIALS_PATH = BASE_DIR / 'Credentials.json'
TOKEN_PATH = BASE_DIR / 'token.json'


def get_credentials():
    """Retrieve valid user credentials from token.json or refresh if expired."""
    creds = None
    if TOKEN_PATH.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        except Exception as e:
            print(f"Error loading credentials from token.json: {e}")
            return None

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            with open(TOKEN_PATH, 'w') as token_file:
                token_file.write(creds.to_json())
            return creds
        except Exception as e:
            print(f"Error refreshing expired credentials: {e}")
            return None

    return None


def is_authenticated():
    """Check if valid credentials exist."""
    return get_credentials() is not None


def create_oauth_flow(redirect_uri='http://localhost:5000/home', state=None):
    """Instantiate the OAuth Flow from Credentials.json."""
    if not CREDENTIALS_PATH.exists():
        raise FileNotFoundError(f"Missing {CREDENTIALS_PATH}. Please provide valid Google OAuth credentials.")

    return Flow.from_client_secrets_file(
        str(CREDENTIALS_PATH),
        scopes=SCOPES,
        state=state,
        redirect_uri=redirect_uri
    )


# In-memory store for PKCE verifiers keyed by state (bulletproof fallback for redirects)
_PKCE_VERIFIERS = {}


def get_authorization_url(redirect_uri='http://localhost:5000/home'):
    """Generate the Google OAuth consent URL and capture PKCE code_verifier."""
    flow = create_oauth_flow(redirect_uri=redirect_uri)
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    code_verifier = getattr(flow, 'code_verifier', None)
    if state and code_verifier:
        _PKCE_VERIFIERS[state] = code_verifier

    return authorization_url, state, code_verifier


def exchange_code(code, state=None, code_verifier=None, redirect_uri='http://localhost:5000/home'):
    """Exchange authorization code for access/refresh tokens and persist them."""
    flow = create_oauth_flow(redirect_uri=redirect_uri, state=state)
    
    # Restore PKCE code_verifier from parameter or memory store
    verifier = code_verifier or _PKCE_VERIFIERS.pop(state, None)
    if verifier:
        flow.code_verifier = verifier

    flow.fetch_token(code=code)
    creds = flow.credentials

    with open(TOKEN_PATH, 'w') as token_file:
        token_file.write(creds.to_json())

    return creds



def clear_credentials():
    """Remove stored credentials on logout."""
    if TOKEN_PATH.exists():
        try:
            TOKEN_PATH.unlink()
            return True
        except Exception as e:
            print(f"Error deleting token file: {e}")
            return False
    return True

