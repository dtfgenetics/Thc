#!/usr/bin/env python3
"""Read-only QA gate for a Metricool scheduled-post JSON export.

Usage: python scripts/thc_social_release_audit.py posts.json
Accepts {"data": [...]} or a raw list. Exits 2 when risky automatic video
posts or publishing errors are detected. Never modifies posts.
"""
import json
import pathlib
import sys
from urllib.parse import urlsplit

CANONICAL_INVITE = "https://discord.gg/ZzYTUWKKW"
VIDEO_SUFFIXES = (".mp4", ".mov", ".m4v", ".webm")
VIDEO_TYPES = {"REEL", "STORY", "VIDEO", "SHORT"}


def media_is_video(item):
    if isinstance(item, str):
        return urlsplit(item).path.lower().endswith(VIDEO_SUFFIXES)
    if isinstance(item, dict):
        if "video" in str(item.get("type") or item.get("mimeType") or "").lower():
            return True
        return any(media_is_video(item.get(k)) for k in ("url", "mediaUrl", "src", "fileName") if item.get(k))
    return False


def audit(posts):
    findings = []
    for post in posts:
        ident = str(post.get("id", "unknown"))
        providers = post.get("providers") or []
        media = post.get("media") or []
        video = any(media_is_video(item) for item in media)
        video = video or any(isinstance(post.get(k), dict) and str(post[k].get("type", "")).upper() in VIDEO_TYPES for k in ("facebookData", "instagramData", "youtubeData"))
        active = post.get("draft") is False and post.get("autoPublish") is True
        if video and ("draft" not in post or "autoPublish" not in post):
            findings.append({"id": ident, "severity": "BLOCK", "code": "UNKNOWN_VIDEO_PUBLISH_STATE", "detail": "Cannot verify video safety"})
        if video and active:
            findings.append({"id": ident, "severity": "BLOCK",
                             "code": "UNAPPROVED_VIDEO_AUTOPUBLISH",
                             "detail": "Active video requires independent human/science/license QA."})
        for provider in providers:
            if provider.get("status") == "ERROR":
                findings.append({"id": ident, "severity": "BLOCK",
                                 "code": "PUBLISH_ERROR",
                                 "detail": provider.get("detailedStatus", "Provider error")})
        body = post.get("text") or ""
        if "discord.gg/" in body and CANONICAL_INVITE not in body:
            findings.append({"id": ident, "severity": "WARN",
                             "code": "NONCANONICAL_INVITE",
                             "detail": "Review Discord destination."})
        if not post.get("publicationDate"):
            findings.append({"id": ident, "severity": "WARN",
                             "code": "MISSING_PUBLICATION_DATE",
                             "detail": "Missing schedule timestamp."})
    return findings


def main():
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 64
    payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    posts = payload["data"] if isinstance(payload, dict) else payload
    if not isinstance(posts, list):
        raise ValueError("Expected a post list or {'data': [...]} object")
    findings = audit(posts)
    result = {"posts_inspected": len(posts), "findings": findings,
              "blocking_count": sum(x["severity"] == "BLOCK" for x in findings)}
    print(json.dumps(result, indent=2))
    return 2 if result["blocking_count"] else 0


if __name__ == "__main__":
    sys.exit(main())
