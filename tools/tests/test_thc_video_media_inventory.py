"""Regression tests for THC video and image media intake."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from thc_video_media_inventory import inspect_file, inventory

class InventoryTests(unittest.TestCase):
    def _make_image(self, path):
        subprocess.run(["ffmpeg","-y","-loglevel","error","-f","lavfi","-i",
            "color=c=green:s=64x64:d=0.1","-frames:v","1",str(path)],
            check=True, capture_output=True)

    def test_still_image_classified(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"plant.jpg"
            self._make_image(path)
            data=inspect_file(path,tmp)
            self.assertEqual(data["type"],"image")
            self.assertFalse(data["release_eligible"])

    def test_valid_video_classified(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"plant.mp4"
            subprocess.run(["ffmpeg","-y","-loglevel","error","-f","lavfi","-i",
                "color=c=green:s=64x64:d=1","-c:v","libx264",str(path)],
                check=True,capture_output=True)
            self.assertEqual(inspect_file(path,tmp)["type"],"video")

    def test_audio_unverified(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"voice.wav"
            subprocess.run(["ffmpeg","-y","-loglevel","error","-f","lavfi","-i",
                "anullsrc=r=48000:cl=mono","-t","0.4",str(path)],
                check=True,capture_output=True)
            self.assertEqual(inspect_file(path,tmp)["human_voice"],"NOT_ASSESSED")

    def test_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            original=Path(tmp)/"real.jpg"
            self._make_image(original)
            link=Path(tmp)/"alias.jpg"
            link.symlink_to(original)
            with self.assertRaisesRegex(ValueError,"symlink"):
                inspect_file(link,tmp)

    def test_corrupt_file_recorded_not_approved(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp)/"broken.mp4").write_bytes(b"not a video")
            data=inventory(tmp)
            self.assertEqual(len(data["assets"]),0)
            self.assertEqual(len(data["rejected"]),1)

    def test_empty_file_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"empty.wav"
            path.write_bytes(b"")
            with self.assertRaises(ValueError):
                inspect_file(path,tmp)

if __name__=="__main__":
    unittest.main()
