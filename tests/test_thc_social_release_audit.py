"""Regression tests for THC's read-only publishing safety audit."""
import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "thc_social_release_audit.py"
spec = importlib.util.spec_from_file_location("thc_social_release_audit", SCRIPT)
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)


class SocialReleaseAuditTests(unittest.TestCase):
    def test_active_video_is_blocked(self):
        posts = [{"id": 1, "draft": False, "autoPublish": True,
                  "media": ["https://cdn.example/video.mp4?token=123"],
                  "publicationDate": {"dateTime": "2026-10-17T17:00:00"},
                  "providers": [{"network": "facebook", "status": "PENDING"}]}]
        self.assertIn("UNAPPROVED_VIDEO_AUTOPUBLISH",
                      [x["code"] for x in audit_module.audit(posts)])

    def test_held_video_is_not_blocked(self):
        posts = [{"id": 2, "draft": True, "autoPublish": False,
                  "media": ["https://cdn.example/video.mp4"],
                  "publicationDate": {"dateTime": "2026-10-17T17:00:00"}}]
        self.assertEqual(audit_module.audit(posts), [])

    def test_provider_error_is_blocked(self):
        posts = [{"id": 3, "draft": False, "autoPublish": True, "media": [],
                  "publicationDate": {"dateTime": "2026-10-17T17:00:00"},
                  "providers": [{"network": "instagram", "status": "ERROR",
                                 "detailedStatus": "You have reached your Metricool account limit."}]}]
        self.assertIn("PUBLISH_ERROR", [x["code"] for x in audit_module.audit(posts)])

    def test_old_invite_warns(self):
        posts = [{"id": 4, "draft": False, "autoPublish": True, "media": [],
                  "publicationDate": {"dateTime": "2026-10-17T17:00:00"},
                  "text": "Join https://discord.gg/OLDINVITE"}]
        self.assertIn("NONCANONICAL_INVITE",
                      [x["code"] for x in audit_module.audit(posts)])


if __name__ == "__main__":
    unittest.main()
