"""Check linker argument preservation and optionally the pinned vendor patch."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile


parser = argparse.ArgumentParser()
parser.add_argument("--archive", type=Path, help="h-raylib-5.6.0.0.tar.gz")
args = parser.parse_args()
web = Path(__file__).resolve().parents[1]

cases = [
    (["--stack-first", "-o", "game.wasm"], ["-o", "game.wasm"]),
    (["-Wl,--stack-first"], []),
    (["-Wl,--export=startup,--stack-first,--global-base=134217728"],
     ["-Wl,--export=startup,--global-base=134217728"]),
    (["-Xlinker", "--stack-first", "-Xlinker", "--import-memory"],
     ["-Xlinker", "--import-memory"]),
    (["an object with spaces.o", "-Wl,--initial-memory=167772160"],
     ["an object with spaces.o", "-Wl,--initial-memory=167772160"]),
]

with tempfile.TemporaryDirectory(prefix="afterlight-build-check-") as temporary:
    root = Path(temporary).resolve()
    assert root.is_relative_to(Path(tempfile.gettempdir()).resolve())
    clang = root / "wasm32-wasi-clang"
    clang.write_text("#!/usr/bin/env python3\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\n")
    clang.chmod(0o755)
    environment = {**os.environ, "PATH": str(root) + os.pathsep + os.environ["PATH"]}
    for supplied, expected in cases:
        result = subprocess.run(["bash", str(web / "wasm-link"), *supplied],
                                env=environment, check=True, capture_output=True, text=True)
        assert json.loads(result.stdout) == expected, (supplied, result.stdout)
    if args.archive:
        assert hashlib.sha256(args.archive.read_bytes()).hexdigest() == (
            "09aec4df1f8974a90366bd78612839549e387643b20826a519bb4f1e831591aa"
        )
        with tarfile.open(args.archive) as archive:
            # The hash authenticates this archive; also reject path escapes.
            for member in archive.getmembers():
                assert (root / member.name).resolve().is_relative_to(root)
            archive.extractall(root, filter="data")
        vendor = root / "h-raylib-5.6.0.0"
        with (web / "patches/h-raylib-web.patch").open() as patch:
            subprocess.run(["patch", "--batch", "--fuzz=0", "-p1"], cwd=vendor,
                           stdin=patch, check=True, capture_output=True, text=True)
        subprocess.run(["emcc", "-std=c11", "-fsyntax-only", "-I", str(vendor / "raylib/src"),
                        str(web / "checks/abi.c")], check=True)

print(f"Passed {len(cases)} linker cases" + (" and clean-archive patch / C ABI checks" if args.archive else ""))
