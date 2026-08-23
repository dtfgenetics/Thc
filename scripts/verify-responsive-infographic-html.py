#!/usr/bin/env python3
"""Verify responsive image delivery on the visitor-facing THC infographic library."""
from __future__ import annotations

import argparse
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote


class InfographicCardParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.current: dict[str, str] | None = None
        self.article_depth = 0
        self.anchor_stack: list[str] = []
        self.cards: list[dict[str, str]] = []

    def _process_start(self, tag: str, attrs) -> None:
        attr = dict(attrs)
        classes = set(attr.get("class", "").split())
        if tag == "article" and "thc-library-card" in classes and self.current is None:
            self.current = {
                "img_src": "",
                "img_srcset": "",
                "img_sizes": "",
                "img_class": "",
                "image_href": "",
            }
            self.article_depth = 1
        elif tag == "article" and self.current is not None:
            self.article_depth += 1

        if self.current is None:
            return
        if tag == "a":
            self.anchor_stack.append(unquote(attr.get("href", "")))
        elif tag == "img":
            self.current["img_src"] = unquote(attr.get("src", ""))
            self.current["img_srcset"] = unquote(attr.get("srcset", ""))
            self.current["img_sizes"] = attr.get("sizes", "")
            self.current["img_class"] = attr.get("class", "")
            self.current["image_href"] = self.anchor_stack[-1] if self.anchor_stack else ""

    def handle_starttag(self, tag: str, attrs) -> None:
        self._process_start(tag, attrs)

    def handle_startendtag(self, tag: str, attrs) -> None:
        # WordPress commonly serializes images as <img ... />. HTMLParser sends
        # those tags here instead of handle_starttag(), so both paths must share
        # the same attribute extraction logic.
        self._process_start(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if self.current is None:
            return
        if tag == "a" and self.anchor_stack:
            self.anchor_stack.pop()
        if tag == "article":
            self.article_depth -= 1
            if self.article_depth == 0:
                self.cards.append(self.current)
                self.current = None
                self.anchor_stack.clear()


def analyze(html: str, minimum: int) -> dict[str, int]:
    parser = InfographicCardParser()
    parser.feed(html)
    cards = parser.cards
    responsive = [
        card
        for card in cards
        if card["img_srcset"]
        and card["img_sizes"]
        and "dtf-responsive-education" in card["img_class"].split()
    ]
    reduced = [
        card
        for card in responsive
        if card["image_href"] and card["img_src"] and card["image_href"] != card["img_src"]
    ]
    masters = [
        card
        for card in responsive
        if "/wp-content/uploads/" in card["image_href"]
    ]

    result = {
        "cards": len(cards),
        "responsive": len(responsive),
        "reducedDisplaySource": len(reduced),
        "fullSizeWordPressLinks": len(masters),
    }
    if result["cards"] < minimum:
        raise ValueError(f"Expected at least {minimum} infographic cards, found {result['cards']}")
    if result["responsive"] < minimum:
        raise ValueError(f"Only {result['responsive']} cards have responsive attributes")
    if result["reducedDisplaySource"] < minimum:
        raise ValueError(
            f"Only {result['reducedDisplaySource']} cards use a smaller display source than their full-size link"
        )
    if result["fullSizeWordPressLinks"] < minimum:
        raise ValueError(
            f"Only {result['fullSizeWordPressLinks']} cards preserve WordPress full-size media links"
        )
    return result


def self_test() -> None:
    full = "https://example.test/wp-content/uploads/2026/08/example.png"
    medium = "https://example.test/wp-content/uploads/2026/08/example-819x1024.png"
    html = f'''<article class="thc-visual-card thc-library-card">
<a class="thc-visual-image" href="{full}">
<img class="wp-image-42 dtf-responsive-education" src="{medium}" srcset="{medium} 819w, {full} 1280w" sizes="(max-width:700px) 92vw, 360px" loading="lazy" decoding="async" />
</a></article>'''
    result = analyze(html, 1)
    if result != {
        "cards": 1,
        "responsive": 1,
        "reducedDisplaySource": 1,
        "fullSizeWordPressLinks": 1,
    }:
        raise AssertionError(f"Unexpected self-test result: {result}")
    print(json.dumps({"selfTest": "passed", **result}, indent=2))


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
    html = args.html.read_text(encoding="utf-8")
    result = analyze(html, args.minimum)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
