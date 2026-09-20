"""Check font fidelity, generated manifests and actual HTTP compression/cache behavior."""
import argparse
from functools import partial
import gzip
import http.client
from http.server import ThreadingHTTPServer
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import unittest

WEB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WEB))
from serve import BuildHandler

spec = importlib.util.spec_from_file_location("prepare_assets", WEB / "prepare-assets.py")
assets_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets_module)
OPTIONS = None


class QuietHandler(BuildHandler):
    def log_message(self, *_args):
        pass


class HttpChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.site = Path(cls.temporary.name)
        cls.data = b"\0asm\1\0\0\0" + b"afterlight" * 1024
        (cls.site / "module.wasm").write_bytes(cls.data)
        (cls.site / "index.html").write_text("<html>Afterlight</html>")
        assets_module.compress_site(cls.site, ["module.wasm"])
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=cls.temporary.name))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temporary.cleanup()

    def request(self, headers=None, path="/module.wasm", method="GET"):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port)
        try:
            connection.request(method, path, headers=headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_encoded_response_and_head(self):
        status, headers, data = self.request({"Accept-Encoding": "gzip"})
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "application/wasm")
        self.assertEqual(headers["Content-Encoding"], "gzip")
        self.assertEqual(headers["Content-Length"], str(len(data)))
        self.assertEqual(headers["Vary"], "Accept-Encoding")
        self.assertEqual(headers["Cache-Control"], "no-cache")
        self.assertEqual(gzip.decompress(data), self.data)
        status, head, data = self.request({"Accept-Encoding": "gzip"}, method="HEAD")
        self.assertEqual((status, head["ETag"], head["Content-Length"], data),
                         (200, headers["ETag"], headers["Content-Length"], b""))

    def test_encoding_preferences_and_refusals(self):
        for accept in ("", "gzip;q=0", "gzip;q=0, *;q=1", "GZIP;Q=0", "gzip;q=0.5, identity;q=1"):
            with self.subTest(accept=accept):
                status, headers, data = self.request({"Accept-Encoding": accept})
                self.assertEqual((status, data), (200, self.data))
                self.assertNotIn("Content-Encoding", headers)
        status, headers, data = self.request({"Accept-Encoding": "gzip;q=1, identity;q=0"})
        self.assertEqual((status, gzip.decompress(data)), (200, self.data))
        for accept, path in (("gzip;q=0, identity;q=0", "/module.wasm"), ("*;q=0", "/module.wasm"),
                             ("gzip, identity;q=0", "/index.html")):
            with self.subTest(accept=accept, path=path):
                self.assertEqual(self.request({"Accept-Encoding": accept}, path=path)[0], 406)

    def test_variant_etags_and_conditional_requests(self):
        _, raw_headers, _ = self.request()
        _, gzip_headers, _ = self.request({"Accept-Encoding": "gzip"})
        self.assertNotEqual(raw_headers["ETag"], gzip_headers["ETag"])
        for etag in (gzip_headers["ETag"], "W/" + gzip_headers["ETag"], "*"):
            status, headers, body = self.request({"Accept-Encoding": "gzip", "If-None-Match": etag})
            self.assertEqual((status, body, headers["ETag"]), (304, b"", gzip_headers["ETag"]))
            self.assertEqual((headers["Cache-Control"], headers["Vary"]), ("no-cache", "Accept-Encoding"))
        status, _, _ = self.request({"Accept-Encoding": "gzip", "If-None-Match": raw_headers["ETag"]})
        self.assertEqual(status, 200)

    def test_rebuild_invalidates_stale_sidecar_and_etag(self):
        path = self.site / "changed.wasm"
        path.write_bytes(self.data)
        assets_module.compress_site(self.site, [path.name])
        _, old_headers, _ = self.request(path="/changed.wasm")
        path.write_bytes(b"new browser build")
        stamp = path.with_name(path.name + ".gz").stat().st_mtime_ns + 1_000_000_000
        os.utime(path, ns=(stamp, stamp))
        status, headers, body = self.request({"Accept-Encoding": "gzip", "If-None-Match": old_headers["ETag"]}, path="/changed.wasm")
        self.assertEqual((status, body), (200, b"new browser build"))
        self.assertNotIn("Content-Encoding", headers)
        self.assertNotEqual(headers["ETag"], old_headers["ETag"])


class AssetChecks(unittest.TestCase):
    def test_source_comment_can_contain_characters_missing_from_font(self):
        if not OPTIONS.assets:
            self.skipTest("Pass --assets to compare the original font")
        from fontTools.ttLib import TTFont

        source = OPTIONS.assets / assets_module.FONT
        with TTFont(source) as font:
            unsupported = next(point for point in range(0x1F600, 0x1F650) if point not in font.getBestCmap())
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            (repo / "src").mkdir()
            code = repo / "src/Main.hs"
            code.write_text('module Main where\nlabel = "庭"\n', encoding="utf-8")
            before = assets_module.font_codepoints(OPTIONS.assets, repo)
            code.write_text(code.read_text(encoding="utf-8") + f"-- Comment {chr(unsupported)}\n", encoding="utf-8")
            after = assets_module.font_codepoints(OPTIONS.assets, repo)
            self.assertEqual(after, before, "An unsupported source comment must not alter the font subset")
            assets_module.subset_font(source, repo / "subset.otf", after)

    def test_explicit_glyphs_still_require_font_coverage(self):
        if not OPTIONS.assets:
            self.skipTest("Pass --assets to compare the original font")
        from fontTools.ttLib import TTFont

        source = OPTIONS.assets / assets_module.FONT
        with TTFont(source) as font:
            unsupported = next(point for point in range(0x1F600, 0x1F650) if point not in font.getBestCmap())
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            (repo / "src").mkdir()
            (repo / "src/Main.hs").write_text("module Main where\n", encoding="utf-8")
            assets = repo / "assets"
            (assets / "fonts").mkdir(parents=True)
            shutil.copyfile(source, assets / assets_module.FONT)
            (assets / "fonts/glyphs.txt").write_text(chr(unsupported), encoding="utf-8")
            with self.assertRaisesRegex(SystemExit, f"Font lacks required characters:.*U\\+{unsupported:04X}"):
                points = assets_module.font_codepoints(assets, repo)
                assets_module.subset_font(assets / assets_module.FONT, repo / "subset.otf", points)

    def test_prepared_site(self):
        if not OPTIONS.site:
            self.skipTest("Pass --site to check a generated build")
        site = OPTIONS.site.resolve()
        manifest = json.loads((site / "assets-manifest.json").read_text())
        self.assertEqual(len({item["path"] for item in manifest}), len(manifest))
        for item in manifest:
            self.assertEqual((site / item["path"]).stat().st_size, item["bytes"], item["path"])
        for path in site.rglob("*.gz"):
            self.assertEqual(gzip.decompress(path.read_bytes()), path.with_suffix("").read_bytes(), str(path))

    def test_subset_matches_source_glyphs_and_metadata(self):
        if not OPTIONS.assets:
            self.skipTest("Pass --assets to compare the original font")
        from fontTools.pens.recordingPen import RecordingPen
        from fontTools.ttLib import TTFont

        points = assets_module.font_codepoints(OPTIONS.assets, WEB.parent)
        source = OPTIONS.assets / assets_module.FONT
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "subset.otf"
            assets_module.subset_font(source, target, points)
            first = target.read_bytes()
            assets_module.subset_font(source, target, points)
            self.assertEqual(target.read_bytes(), first, "Subset must be reproducible")
            with TTFont(source) as original, TTFont(target) as smaller:
                names = lambda font: {(record.nameID, record.platformID, record.platEncID, record.langID): record.toUnicode()
                                      for record in font["name"].names}
                self.assertEqual(names(original), names(smaller), "Keep copyright/license and naming metadata")
                before_map, after_map = original.getBestCmap(), smaller.getBestCmap()
                before_glyphs, after_glyphs = original.getGlyphSet(), smaller.getGlyphSet()
                for point in points:
                    with self.subTest(codepoint=f"U+{point:04X}"):
                        before, after = RecordingPen(), RecordingPen()
                        before_glyphs[before_map[point]].draw(before)
                        after_glyphs[after_map[point]].draw(after)
                        self.assertEqual(before.value, after.value)
                        self.assertEqual(original["hmtx"][before_map[point]], smaller["hmtx"][after_map[point]])
                        self.assertEqual(original["vmtx"][before_map[point]], smaller["vmtx"][after_map[point]])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", type=Path, help="Original native assets, for font fidelity checks")
    parser.add_argument("--site", type=Path, help="Generated browser build, for manifest/gzip checks")
    parser.add_argument("--fonttools-wheel", type=Path, help="The pinned wheel downloaded by build.sh")
    OPTIONS = parser.parse_args()
    if OPTIONS.fonttools_wheel:
        sys.path.insert(0, str(OPTIONS.fonttools_wheel.resolve()))
    unittest.main(argv=[sys.argv[0]], verbosity=2)
