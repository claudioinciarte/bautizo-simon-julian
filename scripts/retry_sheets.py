#!/usr/bin/env python3
"""Pide SYNC_ADMIN_TOKEN sin mostrarlo y ejecuta el reintento de Sheets."""

import getpass
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ENDPOINT = os.environ.get(
    "RSVP_ADMIN_ENDPOINT",
    "http://127.0.0.1:4173/api/admin/retry-sheets",
)


def print_response(body: bytes) -> None:
    text = body.decode("utf-8", errors="replace")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        print(text)
    else:
        print(json.dumps(parsed, ensure_ascii=False, separators=(",", ":")))


def main() -> int:
    token = getpass.getpass("SYNC_ADMIN_TOKEN: ").strip()
    if not token:
        print("No se introdujo ningún token.", file=sys.stderr)
        return 2

    request = Request(
        ENDPOINT,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=60) as response:
            print_response(response.read())
            return 0
    except HTTPError as error:
        print(f"HTTP {error.code}:", file=sys.stderr)
        print_response(error.read())
        return 1
    except URLError as error:
        print(f"No se pudo conectar con el servidor RSVP: {error.reason}", file=sys.stderr)
        return 1
    except TimeoutError:
        print("La petición tardó más de 60 segundos y agotó el tiempo de espera.", file=sys.stderr)
        return 1
    finally:
        # Elimina las referencias locales al terminar. Python no garantiza
        # el borrado físico inmediato de cadenas inmutables de la memoria.
        token = ""
        request = None


if __name__ == "__main__":
    raise SystemExit(main())
