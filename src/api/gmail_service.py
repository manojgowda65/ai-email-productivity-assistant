import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from googleapiclient.discovery import build

BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from src.api.auth import get_credentials
    from src.api.utils import (
        parse_message_summary,
        extract_body_and_attachments,
        parse_header,
        parse_sender,
        format_email_date
    )
except ImportError:
    from auth import get_credentials
    from utils import (
        parse_message_summary,
        extract_body_and_attachments,
        parse_header,
        parse_sender,
        format_email_date
    )



def get_gmail_service():
    """Build and return an authenticated Gmail API service client."""
    creds = get_credentials()
    if not creds:
        return None
    return build('gmail', 'v1', credentials=creds, cache_discovery=False)


from googleapiclient.errors import HttpError


def check_google_error(e):
    """Format readable Google API errors."""
    error_msg = str(e)
    if "accessNotConfigured" in error_msg or "has not been used in project" in error_msg:
        return (
            "Gmail API is not enabled in your Google Cloud project. "
            "Please visit https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=email-assistant-514600 "
            "and click ENABLE."
        )
    return error_msg


def get_user_profile():
    """Retrieve the authenticated user's email address and profile stats."""
    service = get_gmail_service()
    if not service:
        return {"error": "Not authenticated", "authenticated": False}
    try:
        profile = service.users().getProfile(userId='me').execute()
        return {
            "emailAddress": profile.get('emailAddress'),
            "messagesTotal": profile.get('messagesTotal', 0),
            "threadsTotal": profile.get('threadsTotal', 0),
            "historyId": profile.get('historyId')
        }
    except HttpError as e:
        err = check_google_error(e)
        print(f"Google API Error getting user profile: {err}")
        return {"error": err, "apiDisabled": "not enabled" in err.lower()}
    except Exception as e:
        print(f"Error getting user profile: {e}")
        return {"error": str(e)}



def get_labels():
    """Retrieve standard system labels and their unread counts."""
    service = get_gmail_service()
    if not service:
        return []
    try:
        res = service.users().labels().list(userId='me').execute()
        labels = res.get('labels', [])
        
        target_labels = ['INBOX', 'STARRED', 'SENT', 'DRAFT', 'TRASH', 'SPAM']
        label_map = {}
        for l in labels:
            if l.get('id') in target_labels or l.get('name') in target_labels:
                # Fetch detailed unread counts
                detail = service.users().labels().get(userId='me', id=l['id']).execute()
                label_map[l['id']] = {
                    "id": l['id'],
                    "name": l.get('name'),
                    "messagesUnread": detail.get('messagesUnread', 0),
                    "messagesTotal": detail.get('messagesTotal', 0),
                    "threadsUnread": detail.get('threadsUnread', 0)
                }
        return label_map
    except Exception as e:
        print(f"Error retrieving labels: {e}")
        return {}


def fetch_single_message_summary(service, msg_id):
    """Fetch metadata for a single message for list view."""
    try:
        msg = service.users().messages().get(
            userId='me',
            id=msg_id,
            format='metadata',
            metadataHeaders=['From', 'Subject', 'Date', 'To']
        ).execute()
        return parse_message_summary(msg)
    except Exception as e:
        print(f"Error fetching message metadata {msg_id}: {e}")
        return None


def list_messages(folder='INBOX', query='', page_token=None, max_results=25):
    """
    List messages filtered by folder label or search query,
    using Google's native batch HTTP request for lightning-fast retrieval.
    """
    service = get_gmail_service()
    if not service:
        return {"error": "Not authenticated", "messages": []}

    kwargs = {
        "userId": "me",
        "maxResults": max_results
    }
    if page_token:
        kwargs["pageToken"] = page_token

    folder_upper = (folder or 'INBOX').upper()
    valid_folders = ['INBOX', 'STARRED', 'SENT', 'DRAFT', 'TRASH', 'SPAM']
    
    if folder_upper in valid_folders:
        kwargs["labelIds"] = [folder_upper]

    if query:
        kwargs["q"] = query.strip()

    try:
        list_res = service.users().messages().list(**kwargs).execute()
        raw_messages = list_res.get('messages', [])
        next_page_token = list_res.get('nextPageToken', None)
        result_size_estimate = list_res.get('resultSizeEstimate', len(raw_messages))

        # Native Batch HTTP request (single socket round-trip, thread-safe & fast)
        messages = []
        if raw_messages:
            msg_ids = [m['id'] for m in raw_messages]
            results_dict = {}

            def batch_callback(request_id, response, exception):
                if exception is None and response:
                    parsed = parse_message_summary(response)
                    if parsed:
                        results_dict[response.get('id')] = parsed
                elif exception:
                    print(f"Batch fetch error: {exception}")

            batch = service.new_batch_http_request(callback=batch_callback)
            for mid in msg_ids:
                batch.add(
                    service.users().messages().get(
                        userId='me',
                        id=mid,
                        format='metadata',
                        metadataHeaders=['From', 'Subject', 'Date', 'To']
                    )
                )
            batch.execute()

            # Preserve exact order returned by Gmail list
            messages = [results_dict[mid] for mid in msg_ids if mid in results_dict]

        return {
            "messages": messages,
            "nextPageToken": next_page_token,
            "resultSizeEstimate": result_size_estimate,
            "folder": folder_upper
        }
    except HttpError as e:
        err = check_google_error(e)
        print(f"Google API Error listing messages: {err}")
        return {"error": err, "apiDisabled": "not enabled" in err.lower(), "messages": []}
    except Exception as e:
        print(f"Error listing messages: {e}")
        return {"error": str(e), "messages": []}



def get_thread_details(thread_id):
    """Fetch all messages in a thread with full rendered content."""
    service = get_gmail_service()
    if not service:
        return {"error": "Not authenticated"}

    try:
        thread_data = service.users().threads().get(
            userId='me',
            id=thread_id,
            format='full'
        ).execute()

        raw_msgs = thread_data.get('messages', [])
        messages = []
        subject = "(no subject)"

        for msg in raw_msgs:
            payload = msg.get('payload', {})
            headers = payload.get('headers', [])
            
            msg_subject = parse_header(headers, 'Subject')
            if msg_subject and subject == "(no subject)":
                subject = msg_subject

            from_header = parse_header(headers, 'From')
            to_header = parse_header(headers, 'To')
            date_header = parse_header(headers, 'Date')
            internal_date = msg.get('internalDate', '')
            label_ids = msg.get('labelIds', [])

            body_content = extract_body_and_attachments(payload)

            messages.append({
                "id": msg.get('id'),
                "threadId": msg.get('threadId'),
                "sender": parse_sender(from_header),
                "recipient": to_header,
                "dateFormatted": format_email_date(internal_date, date_header),
                "internalDate": internal_date,
                "snippet": msg.get('snippet', ''),
                "bodyText": body_content['text'],
                "bodyHtml": body_content['html'],
                "attachments": body_content['attachments'],
                "isUnread": 'UNREAD' in label_ids,
                "isStarred": 'STARRED' in label_ids,
                "labels": label_ids
            })

        return {
            "threadId": thread_id,
            "subject": subject,
            "messageCount": len(messages),
            "messages": messages
        }
    except Exception as e:
        print(f"Error fetching thread {thread_id}: {e}")
        return {"error": str(e)}


def modify_message(message_id, add_labels=None, remove_labels=None):
    """Add or remove labels from a message (e.g. STARRED, UNREAD)."""
    service = get_gmail_service()
    if not service:
        return {"error": "Not authenticated"}
    try:
        body = {
            "addLabelIds": add_labels or [],
            "removeLabelIds": remove_labels or []
        }
        res = service.users().messages().modify(userId='me', id=message_id, body=body).execute()
        return {"success": True, "labels": res.get('labelIds', [])}
    except Exception as e:
        print(f"Error modifying message {message_id}: {e}")
        return {"error": str(e)}


def trash_message(message_id):
    """Move a message to the Trash folder."""
    service = get_gmail_service()
    if not service:
        return {"error": "Not authenticated"}
    try:
        service.users().messages().trash(userId='me', id=message_id).execute()
        return {"success": True}
    except Exception as e:
        print(f"Error trashing message {message_id}: {e}")
        return {"error": str(e)}


def untrash_message(message_id):
    """Restore a message from the Trash folder."""
    service = get_gmail_service()
    if not service:
        return {"error": "Not authenticated"}
    try:
        service.users().messages().untrash(userId='me', id=message_id).execute()
        return {"success": True}
    except Exception as e:
        print(f"Error untrashing message {message_id}: {e}")
        return {"error": str(e)}

