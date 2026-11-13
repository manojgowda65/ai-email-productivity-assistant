import os
from src.api.app import app

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"\n🚀 Starting Gmail Clone on http://localhost:{port} (matching OAuth redirect URI)\n")
    app.run(host='0.0.0.0', port=port, debug=True)

