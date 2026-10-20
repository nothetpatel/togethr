#!/usr/bin/env python3
"""
Run a Blender Python script in the Blender you have open, and print the result.

Talks to whichever Blender MCP add-on is running on localhost:9876:
Blender Lab's official "MCP" extension (blender.org/lab/mcp-server), or the
community "MCP for Blender" add-on (addon.py). Only enable one; they share
the port. The script should put what it wants to report in a dict named
`result`.

Usage:
    python3 scripts/blender/run.py scripts/blender/animals/cat.py
    python3 scripts/blender/run.py -c "import bpy; result = {'objects': len(bpy.data.objects)}"

Setup (once, in Blender): Preferences → System → Network → Allow Online
Access, and enable the "MCP" add-on (it starts its server automatically).
With the community add-on instead: press N in the 3D view → MCP for Blender
→ Connect.
"""

import argparse
import json
import socket
import sys
from pathlib import Path

HOST = "localhost"
PORT = 9876


RESULT_MARK = "@@togethr-result@@"


def _exchange(payload: bytes, timeout: float, done) -> bytes:
    """Send one request and read until `done(data)` says the reply is complete."""
    with socket.create_connection((HOST, PORT), timeout=timeout) as conn:
        conn.sendall(payload)
        buf = bytearray()
        while not done(bytes(buf)):
            chunk = conn.recv(65536)
            if not chunk:
                break
            buf.extend(chunk)
    return bytes(buf)


def _complete_json(data: bytes) -> bool:
    try:
        json.loads(data)
        return True
    except ValueError:
        return False


def run_official(code: str, timeout: float) -> dict:
    """Blender Lab's add-on: null-byte-delimited JSON, returns the script's `result`."""
    payload = (json.dumps({"type": "execute", "code": code, "strict_json": True}) + "\0").encode("utf-8")
    reply = _exchange(payload, timeout, lambda d: b"\0" in d or _complete_json(d))
    return json.loads(reply.split(b"\0", 1)[0])


def run_community(code: str, timeout: float) -> dict:
    """Community add-on: plain JSON, returns printed output; we print `result` with a marker."""
    wrapped = (
        "result = {}\n"
        + code
        + "\nimport json as _json\n"
        + f"print({RESULT_MARK!r} + _json.dumps(result, default=repr))\n"
    )
    payload = json.dumps({"type": "execute_code", "params": {"code": wrapped}}).encode("utf-8")
    reply = json.loads(_exchange(payload, timeout, _complete_json))
    if reply.get("status") != "success":
        return {"status": "error", "message": reply.get("message", reply)}
    inner = reply.get("result", {})
    if isinstance(inner, dict) and inner.get("executed") is False:
        return {"status": "error", "message": inner.get("traceback") or inner.get("error") or inner}
    out = inner.get("result", "") if isinstance(inner, dict) else str(inner)
    stdout, _, marked = out.rpartition(RESULT_MARK)
    return {"status": "ok", "result": json.loads(marked) if marked else {}, "stdout": stdout}


def run(code: str, timeout: float) -> dict:
    response = run_official(code, timeout)
    # The community add-on answers the official request with "Unknown command type".
    if response.get("status") == "error" and "Unknown command type" in str(response.get("message", "")):
        return run_community(code, timeout)
    return response


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("script", nargs="?", help="Python file to run inside Blender")
    parser.add_argument("-c", "--code", help="Python code to run instead of a file")
    parser.add_argument("--timeout", type=float, default=300, help="seconds to wait (default 300)")
    args = parser.parse_args()

    if args.code is not None:
        code = args.code
    elif args.script:
        path = Path(args.script).resolve()
        # Let the script import its neighbours (e.g. common.py) and know where it lives.
        code = (
            "import sys as _sys\n"
            f"_sys.path.insert(0, {str(path.parent)!r})\n"
            f"_sys.path.insert(0, {str(path.parent.parent)!r})\n"
            f"__file__ = {str(path)!r}\n"
            # Blender keeps imported modules between runs; reload our helpers.
            "_sys.modules.pop('common', None)\n"
            + path.read_text()
        )
    else:
        parser.error("give a script file or -c CODE")

    try:
        response = run(code, args.timeout)
    except ConnectionRefusedError:
        print(
            "Couldn't reach Blender on localhost:9876. Is Blender open, with Online Access\n"
            "allowed (Preferences → System → Network) and the MCP add-on enabled?",
            file=sys.stderr,
        )
        return 2

    for stream in ("stdout", "stderr"):
        if response.get(stream):
            print(response[stream], end="", file=sys.stdout if stream == "stdout" else sys.stderr)
    if response.get("status") == "ok":
        print(json.dumps(response.get("result", {}), indent=2))
        return 0
    print(response.get("message", response), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
