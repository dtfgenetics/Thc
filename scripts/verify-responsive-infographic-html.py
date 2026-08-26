#!/usr/bin/env python3
"""Verify responsive image delivery on the visitor-facing THC infographic library."""
from __future__ import annotations

import argparse
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote


class InfographicLibraryParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.card_count = 0
        self.card_depth = 0
        self.images: list[dict[str, str | bool]] = []
        self.hrefs: list[str] = []

    def _process_start(self, tag: str, attrs) -> None:
        attr = dict(attrs)
        if tag == "article":
            classes = set(attr.get("class", "").split())
            if "thc-library-card" in classes:
                self.card_count += 1
                self.card_depth += 1
            elif self.card_depth:
                self.card_depth += 1
        elif tag == "a":
            href = unquote(attr.get("href", ""))
            if href:
                self.hrefs.append(href)
        elif tag == "img":
            self.images.append(
                {
                    "src": unquote(attr.get("src", "")),
                    "srcset": unquote(attr.get("srcset", "")),
                    "sizes": attr.get("sizes", ""),
                    "class": attr.get("class", ""),
                    "in_card": self.card_depth > 0,
                }
            )

    def handle_starttag(self, tag: str, attrs) -> None:
        self._process_start(tag, attrs)

    def handle_startendtag(self, tag: str, attrs) -> None:
        # WordPress commonly serializes media as <img ... />.
        self._process_start(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag == "article" and self.card_depth:
            self.card_depth -= 1


def analyze(html: str, minimum: int) -> dict[str, int]:
    parser = InfographicLibraryParser()
    parser.feed(html)

    # Verify the visitor-facing behavior rather than a private implementation
    # marker. WordPress/theme render filters may legitimately normalize or drop
    # custom classes while still preserving the browser-critical srcset/sizes.
    # Constrain the count to images inside infographic cards and WordPress media
    # so unrelated responsive site chrome cannot satisfy this gate.
    responsive_images = [
        image
        for image in parser.images
        if image["in_card"]
        and image["srcset"]
        and image["sizes"]
        and "/wp-content/uploads/" in str(image["src"])
    ]
    marker_images = [
        image
        for image in responsive_images
        if "dtf-responsive-education" in str(image["class"]).split()
    ]
    full_size_links = {
        href for href in parser.hrefs if "/wp-content/uploads/" in href
    }
    reduced_images = [
        image
        for image in responsive_images
        if image["src"] and image["src"] not in full_size_links
    ]

    result = {
        "cards": parser.card_count,
        "responsiveEducationImages": len(responsive_images),
        "responsiveMarkerImages": len(marker_images),
        "reducedDisplaySources": len(reduced_images),
        "fullSizeWordPressLinks": len(full_size_links),
    }

    failures: list[str] = []
    if result["cards"] < minimum:
        failures.append(f"only {result['cards']} infographic cards")
    if result["responsiveEducationImages"] < minimum:
        failures.append(f"only {result['responsiveEducationImages']} responsive infographic-card images")
    if result["reducedDisplaySources"] < minimum:
        failures.append(f"only {result['reducedDisplaySources']} reduced display sources")
    if result["fullSizeWordPressLinks"] < minimum:
        failures.append(f"only {result['fullSizeWordPressLinks']} WordPress full-size links")
    if failures:
        raise ValueError("Live infographic verification failed: " + "; ".join(failures) + f". Observed {json.dumps(result, sort_keys=True)}")
    return result


def self_test() -> None:
    full = "https://example.test/wp-content/uploads/2026/08/example.png"
    medium = "https://example.test/wp-content/uploads/2026/08/example-819x1024.png"
    html = f'''<article class="thc-visual-card thc-library-card">
<a class="thc-visual-image" href="{full}">Full-size</a>
<img class="wp-image-42 dtf-responsive-education" src="{medium}" srcset="{medium} 819w, {full} 1280w" sizes="(max-width:700px) 92vw, 360px" loading="lazy" decoding="async" />
</article>'''
    result = analyze(html, 1)
    expected = {
        "cards": 1,
        "responsiveEducationImages": 1,
        "responsiveMarkerImages": 1,
        "reducedDisplaySources": 1,
        "fullSizeWordPressLinks": 1,
    }
    if result != expected:
        raise AssertionError(f"Unexpected self-test result: {result}")

    # WordPress/theme output is allowed to normalize away the private marker;
    # responsive delivery must still verify from card context + srcset/sizes.
    normalized = html.replace(" dtf-responsive-education", "")
    normalized_result = analyze(normalized, 1)
    if normalized_result["responsiveEducationImages"] != 1 or normalized_result["responsiveMarkerImages"] != 0:
        raise AssertionError(f"Normalized-render self-test failed: {normalized_result}")

    print(json.dumps({"selfTest": "passed", **result, "normalizedRender": normalized_result}, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("html", nargs="?", type=Path)
    parser.add_argument("--minimum", type=int, default=20)
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.self_test:
        self_test()
        return 0
    if args.html is None:
        raise ValueError("HTML file path is required unless --self-test is used")
    if args.minimum < 1:
        raise ValueError("--minimum must be at least 1")
    result = analyze(args.html.read_text(encoding="utf-8"), args.minimum)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
