"""Serve a browser build locally, negotiating its precompressed gzip files."""
import argparse
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


def encoding_quality(header: str) -> tuple[float, float]:
    qualities = {}
    for entry in header.lower().split(","):
        coding, *parameters = entry.strip().split(";")
        quality = 1.0
        for parameter in parameters:
            key, separator, value = parameter.strip().partition("=")
            if key.strip() == "q" and separator:
                try:
                    quality = float(value)
                except ValueError:
                    quality = 0.0
                if not 0 <= quality <= 1:
                    quality = 0.0
        if coding:
            qualities[coding] = min(qualities.get(coding, 1.0), quality)
    gzip = qualities.get("gzip", qualities.get("*", 0.0))
    identity = qualities.get("identity", 0.0 if qualities.get("*") == 0 else 1.0)
    return gzip, identity


class BuildHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".wasm": "application/wasm", ".mjs": "text/javascript",
                      ".js": "text/javascript", ".otf": "font/otf"}
    etags = {}

    def end_headers(self):
        # Filenames are stable across builds: a saved response must revalidate.
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Vary", "Accept-Encoding")
        super().end_headers()

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            url = urlsplit(self.path)
            if not url.path.endswith("/"):
                self.send_response(301)
                self.send_header("Location", urlunsplit(url._replace(path=url.path + "/")))
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
            path /= "index.html"
        if not path.is_file():
            self.send_error(404, "File not found")
            return None
        content_type = self.guess_type(str(path))
        gzip_quality, identity_quality = encoding_quality(",".join(self.headers.get_all("Accept-Encoding", [])))
        sidecar = path.with_name(path.name + ".gz")
        encoded = (gzip_quality > 0 and gzip_quality >= identity_quality
                   and sidecar.is_file() and sidecar.stat().st_mtime_ns >= path.stat().st_mtime_ns)
        if not encoded and identity_quality <= 0:
            self.send_error(406, "No acceptable content encoding")
            return None
        selected = sidecar if encoded else path
        try:
            stream = selected.open("rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        stat = os.fstat(stream.fileno())
        stamp = (stat.st_mtime_ns, stat.st_size, stat.st_ino)
        cached = self.etags.get(selected)
        if cached is not None and cached[0] == stamp:
            etag = cached[1]
        else:
            digest = hashlib.sha256()
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
            stream.seek(0)
            etag = '"sha256-' + digest.hexdigest() + '"'
            self.etags[selected] = (stamp, etag)
        matches = [value.strip().removeprefix("W/") for value in self.headers.get("If-None-Match", "").split(",")]
        unchanged = "*" in matches or etag in matches
        self.send_response(304 if unchanged else 200)
        self.send_header("Content-Type", content_type)
        self.send_header("ETag", etag)
        self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
        if encoded:
            self.send_header("Content-Encoding", "gzip")
        if not unchanged:
            self.send_header("Content-Length", str(stat.st_size))
        self.end_headers()
        if unchanged:
            stream.close()
            return None
        return stream


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True, help="Directory emitted by web/build.sh")
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if not args.directory.is_dir():
        parser.error("--directory must exist")
    handler = partial(BuildHandler, directory=str(args.directory.resolve()))
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f"Serving {args.directory.resolve()} at http://{args.bind}:{args.port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
