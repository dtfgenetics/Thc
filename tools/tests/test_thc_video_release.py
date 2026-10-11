"""Regression checks for committed THC release helpers."""
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from thc_video_caption_qa import validate_srt
from thc_video_release_gate import verify

class CaptionPreflight(unittest.TestCase):
    def _check(self, body, ms=30000):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/"sample.srt"
            path.write_text(body,encoding="utf-8")
            return validate_srt(path,ms)

    def test_valid(self):
        self.assertEqual([],self._check("1\n00:00:00,000 --> 00:00:03,000\nHello\n\n2\n00:00:03,000 --> 00:00:05,000\nSeedling"))

    def test_overlap(self):
        self.assertTrue(any("overlap" in x for x in self._check("1\n00:00:00,000 --> 00:00:04,000\nHello\n\n2\n00:00:03,000 --> 00:00:05,000\nWorld")))

    def test_beyond_export(self):
        self.assertTrue(any("beyond video" in x for x in self._check("1\n00:00:00,000 --> 00:00:35,000\nToo late")))

    def test_bad_timestamp(self):
        self.assertTrue(self._check("1\n00:00:66,000 --> 00:00:70,000\nBad"))

    def test_empty(self):
        self.assertEqual(["empty captions"],self._check(""))

    def test_missing_manifest_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            self.assertTrue(any("manifest" in problem.lower() for problem in verify(temp)))

    def test_malformed_manifest_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            (root/"production_manifest.json").write_text("{broken")
            self.assertTrue(any("manifest" in problem.lower() for problem in verify(root)))

    def test_missing_register_blocks(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            (root/"production_manifest.json").write_text("{}")
            self.assertIn("Asset register missing",verify(root))

if __name__=="__main__":
    unittest.main()
