#!/usr/bin/env python3
"""Run the deterministic THC poster renderer with tolerant WordPress media normalization.

WordPress/plugin responses can expose source_url/alt/slug fields as arrays or nested
objects. The base renderer expects scalar strings. This adapter normalizes those
fields without weakening poster validation or changing the poster definitions.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

BASE_PATH = Path(__file__).with_name("render-thc-scientific-posters.py")
spec = importlib.util.spec_from_file_location("thc_scientific_posters", BASE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not import poster renderer: {BASE_PATH}")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

_original_fetch_media_catalog = base.fetch_media_catalog


def scalar_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("rendered", "raw", "url", "source_url"):
            if key in value:
                text = scalar_text(value[key])
                if text:
                    return text
        return " ".join(filter(None, (scalar_text(v) for v in value.values())))
    if isinstance(value, (list, tuple, set)):
        return " ".join(filter(None, (scalar_text(v) for v in value)))
    return str(value)


def first_url(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("rendered", "url", "source_url", "raw"):
            candidate = first_url(value.get(key))
            if candidate:
                return candidate
        for nested in value.values():
            candidate = first_url(nested)
            if candidate:
                return candidate
        return ""
    if isinstance(value, (list, tuple, set)):
        for nested in value:
            candidate = first_url(nested)
            if candidate:
                return candidate
        return ""
    text = scalar_text(value).strip()
    return text if text.startswith(("https://", "http://")) else ""


def normalized_media_catalog():
    rows = _original_fetch_media_catalog()
    normalized = []
    for raw in rows:
        item = dict(raw)
        item["slug"] = scalar_text(item.get("slug")).strip()
        item["alt_text"] = scalar_text(item.get("alt_text")).strip()
        item["source_url"] = first_url(item.get("source_url")) or first_url(item.get("guid"))
        title = item.get("title")
        if isinstance(title, dict):
            item["title"] = {**title, "rendered": scalar_text(title.get("rendered") or title.get("raw")).strip()}
        else:
            item["title"] = scalar_text(title).strip()
        guid = item.get("guid")
        if isinstance(guid, dict):
            item["guid"] = {**guid, "rendered": first_url(guid)}
        else:
            item["guid"] = {"rendered": first_url(guid)}
        normalized.append(item)
    return normalized


base.fetch_media_catalog = normalized_media_catalog

if __name__ == "__main__":
    base.main()
