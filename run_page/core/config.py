from pathlib import Path

# Paths
# Note: config.py is in run_page/core/, so .parent.parent is run_page/
CREDENTIALS_FILE = Path(__file__).parent.parent / "credentials.json"

# Localization
SUPPORTED_LANGUAGES = ["zh", "en"]
DEFAULT_LANGUAGE = "zh"

# Networking
API_PORT = 8000
FRONTEND_PORT = 5173
