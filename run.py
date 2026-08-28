"""
StructuraQS Platform Launcher
Starts the Flask server and opens the Quantity Surveyor application in the default web browser.
"""

import os
import sys
import webbrowser
import threading
import time

def open_browser(port):
    time.sleep(1.2)
    url = f"http://127.0.0.1:{port}"
    print(f"Opening StructuraQS application in browser: {url}")
    webbrowser.open(url)

if __name__ == '__main__':
    from app import app
    port = int(os.environ.get('PORT', 5000))
    
    # Launch browser in a background thread
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()
    
    print("\n" + "="*60)
    print("  STRUCTURA-QS | Quantity Surveyor & Cost Engineering Platform")
    print("  Enterprise Construction-Tech SaaS")
    print(f"  Server URL: http://127.0.0.1:{port}")
    print("  Zero third-party API dependencies.")
    print("="*60 + "\n")
    
    app.run(host='127.0.0.1', port=port, debug=False)
