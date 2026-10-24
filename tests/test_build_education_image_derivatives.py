#!/usr/bin/env python3
"""Regression tests for responsive education-library markup rewriting."""
import runpy
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts" / "build-education-image-derivatives.py"))
Derivative = module["Derivative"]
ImageRecord = module["ImageRecord"]
optimize_img_tag = module["optimize_img_tag"]


class ResponsiveTagTests(unittest.TestCase):
    def setUp(self):
        self.record = ImageRecord(
            source="example.png", source_width=2000, source_height=1000,
            source_bytes=1000, sha256="fixture",
            derivatives=(Derivative("example-640.webp", 640, 320, 100),
                         Derivative("example-1280.webp", 1280, 640, 200)),
        )

    def test_replaces_stale_candidates_without_duplicates(self):
        tag = '<img src="/assets/education/infographics/example.png" srcset="old.jpg 1x" sizes="100vw" alt="Example">'
        rendered = optimize_img_tag(tag, self.record)
        self.assertNotIn("old.jpg", rendered)
        self.assertEqual(rendered.count(" srcset="), 1)
        self.assertEqual(rendered.count(" sizes="), 1)
        self.assertIn("example-1280.webp 1280w", rendered)
        self.assertIn('src="/assets/education/infographics-web/example-640.webp"', rendered)

    def test_single_quote_attributes_and_existing_decoding(self):
        tag = "<img src='/assets/education/infographics/example.png' srcset='stale.jpg 2x' decoding='sync' alt='Example'>"
        rendered = optimize_img_tag(tag, self.record)
        self.assertNotIn("stale.jpg", rendered)
        self.assertEqual(rendered.count(" decoding="), 1)
        self.assertIn('decoding="async"', rendered)
        self.assertIn("alt='Example'", rendered)

    def test_missing_responsive_attributes_are_added(self):
        rendered = optimize_img_tag('<img src="/original.png" alt="">', self.record)
        self.assertIn(" srcset=", rendered)
        self.assertIn(" sizes=", rendered)


if __name__ == "__main__":
    unittest.main()
