#!/usr/bin/env python3
"""Dev server for Vitruvian.

python -m http.server sends Last-Modified and no Cache-Control, so Chrome
applies heuristic freshness and will happily run a stale copy of a file you
just edited. That turns every verification pass into a guess about whether
you are looking at the new code. This one forbids caching outright.

Not used in production: GitHub Pages serves the real thing, and the service
worker does the caching there on purpose.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):          # one line per request is plenty
        sys.stderr.write("%s %s\n" % (self.command, self.path))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4179
    ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
