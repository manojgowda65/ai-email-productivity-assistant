import base64
import email.utils
from datetime import datetime, timezone
from bs4 import BeautifulSoup


def parse_header(headers, header_name):
    """Retrieve header value by name case-insensitively."""
    if not headers:
        return ""
    name_lower = header_name.lower()
    for header in headers:
        if header.get('name', '').lower() == name_lower:
            return header.get('value', '')
    return ""


def parse_sender(from_header):
    """Extract display name and email address from From header."""
    if not from_header:
        return {"name": "Unknown", "email": ""}
    name, addr = email.utils.parseaddr(from_header)
    return {
        "name": name if name else addr,
        "email": addr
    }


def decode_base64_url(data_str):
    """Decode base64url encoded string to utf-8."""
    if not data_str:
        return ""
    try:
        # Standardize base64 url padding
        padded = data_str + '=' * (-len(data_str) % 4)
        decoded_bytes = base64.urlsafe_b64decode(padded.encode('ascii'))
        return decoded_bytes.decode('utf-8', errors='replace')
    except Exception as e:
        print(f"Error decoding base64 payload: {e}")
        return ""


def extract_body_and_attachments(payload):
    """
    Recursively extract HTML, plain text body, and attachment metadata
    from a Gmail message payload.
    """
    body_text = ""
    body_html = ""
    attachments = []

    def walk_parts(part):
        nonlocal body_text, body_html, attachments
        mime_type = part.get('mimeType', '')
        filename = part.get('filename', '')
        body = part.get('body', {})

        if filename and body.get('attachmentId'):
            attachments.append({
                "filename": filename,
                "mimeType": mime_type,
                "size": body.get('size', 0),
                "attachmentId": body.get('attachmentId')
            })

        data = body.get('data')
        if data:
            decoded = decode_base64_url(data)
            if mime_type == 'text/plain' and not body_text:
                body_text = decoded
            elif mime_type == 'text/html' and not body_html:
                body_html = decoded

        parts = part.get('parts', [])
        for sub_part in parts:
            walk_parts(sub_part)

    walk_parts(payload)

    # Fallback if only one format was found
    if not body_html and body_text:
        # Render plain text into basic readable html paragraphs
        escaped = (body_text
                   .replace('&', '&amp;')
                   .replace('<', '&lt;')
                   .replace('>', '&gt;')
                   .replace('\n', '<br/>'))
        body_html = f"<div style='font-family: Roboto, sans-serif; white-space: pre-wrap;'>{escaped}</div>"

    if not body_text and body_html:
        try:
            soup = BeautifulSoup(body_html, 'html.parser')
            body_text = soup.get_text(separator=' ', strip=True)
        except Exception:
            body_text = ""

    return {
        "text": body_text,
        "html": body_html,
        "attachments": attachments
    }


def format_email_date(internal_date_ms, date_header_str=""):
    """
    Format timestamp in Gmail style:
    - Today: '10:45 AM'
    - This year: 'Nov 12'
    - Older: '11/12/2023'
    """
    dt = None
    if internal_date_ms:
        try:
            dt = datetime.fromtimestamp(int(internal_date_ms) / 1000.0, tz=timezone.utc).astimezone()
        except Exception:
            pass

    if not dt and date_header_str:
        try:
            parsed_tuple = email.utils.parsedate_to_datetime(date_header_str)
            if parsed_tuple:
                dt = parsed_tuple.astimezone()
        except Exception:
            pass

    if not dt:
        return date_header_str or ""

    now = datetime.now().astimezone()
    if dt.date() == now.date():
        return dt.strftime('%I:%M %p').lstrip('0')
    elif dt.year == now.year:
        return dt.strftime('%b %d')
    else:
        return dt.strftime('%m/%d/%Y')


def parse_message_summary(msg_data):
    """Parse concise summary of a Gmail message for list rendering."""
    headers = msg_data.get('payload', {}).get('headers', [])
    from_header = parse_header(headers, 'From')
    sender = parse_sender(from_header)
    subject = parse_header(headers, 'Subject') or "(no subject)"
    date_header = parse_header(headers, 'Date')
    internal_date = msg_data.get('internalDate', '')
    label_ids = msg_data.get('labelIds', [])

    return {
        "id": msg_data.get('id'),
        "threadId": msg_data.get('threadId'),
        "sender": sender,
        "subject": subject,
        "snippet": msg_data.get('snippet', ''),
        "dateFormatted": format_email_date(internal_date, date_header),
        "internalDate": internal_date,
        "isUnread": 'UNREAD' in label_ids,
        "isStarred": 'STARRED' in label_ids,
        "labels": label_ids
    }

