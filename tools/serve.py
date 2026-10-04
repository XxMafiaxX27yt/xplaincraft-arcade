"""Local test server for the arcade: like `python -m http.server`, but tells the browser not to cache,
so every reload picks up the latest files.  Run from anywhere:  python tools/serve.py [port]
"""
import http.server, os, sys, functools

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(NoCache, directory=ROOT)).serve_forever()
