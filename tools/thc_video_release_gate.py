"""Fail-closed THC video preflight. Never publish on metadata alone."""
import csv, hashlib, json, subprocess, sys
from thc_video_caption_qa import validate_srt
from pathlib import Path

REQUIRED = {f"S{i:02d}" for i in range(1, 7)} | {"VO01"}
def verify(root):
    root = Path(root).resolve()
    manifest = json.loads((root / "production_manifest.json").read_text())
    issues = []
    for name, expected in {"synthetic_narration": False, "human_narration_confirmed": True,
      "science_review_approved": True, "editorial_review_approved": True,
      "subtitle_sync_confirmed": True, "profile_discord_link_verified": True,
      "publication_approved": True}.items():
        if manifest.get(name) is not expected: issues.append(f"{name}: expected {expected}")
    reg = root / "assets/ASSET_LICENSE_REGISTER.csv"
    if not reg.is_file(): return issues + ["Asset register missing"]
    with reg.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    byid = {}
    for row in rows:
        aid = row.get("asset_id")
        if aid in byid: issues.append(f"{aid}: duplicate asset ID")
        byid[aid] = row
    for aid in sorted(REQUIRED):
        row = byid.get(aid)
        if not row: issues.append(f"{aid}: missing"); continue
        if row.get("verified", "").lower() != "true": issues.append(f"{aid}: unverified")
        authenticity = row.get("authenticity", "")
        if aid == "VO01" and authenticity != "genuine-human-recording":
            issues.append("VO01: no synthetic or robotic narration permitted")
        if aid in ("S01","S04","S05","S06") and authenticity != "genuine-camera-footage":
            issues.append(f"{aid}: authentic camera footage required")
        for field in ("source_url","creator","license","sha256"):
            if not row.get(field): issues.append(f"{aid}: {field} missing")
        for field in ("local_path","license_evidence_file"):
            value = row.get(field)
            path = (root / value).resolve() if value else None
            if path is None or not path.is_relative_to(root) or not path.is_file():
                issues.append(f"{aid}: invalid {field} or missing file")
            elif field == "local_path" and row.get("sha256"):
                if hashlib.sha256(path.read_bytes()).hexdigest() != row["sha256"].lower():
                    issues.append(f"{aid}: sha256 mismatch")
    video_duration_ms = None
    captions_path = None
    for key in ("video_file","captions_file"):
        value = manifest.get(key)
        path = (root / value).resolve() if value else None
        if path is None or not path.is_relative_to(root) or not path.is_file():
            issues.append(f"{key}: not available in workspace")
        elif key == "captions_file":
            if path.suffix.lower() != ".srt":
                issues.append("Captions must be SRT until a VTT parser is implemented")
            else:
                captions_path = path
        elif key == "video_file":
            try:
                data = json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(path)],text=True,timeout=20))
                vid = [s for s in data["streams"] if s["codec_type"]=="video"]
                audio = [s for s in data["streams"] if s["codec_type"]=="audio"]
                if len(vid)!=1 or vid[0].get("codec_name")!="h264" or (vid[0].get("width"),vid[0].get("height"))!=(1080,1920):
                    issues.append("Expected one 1080x1920 H.264 video stream")
                if len(audio)!=1 or audio[0].get("codec_name")!="aac":
                    issues.append("Expected one AAC narration track")
                duration = data.get("format", {}).get("duration") or (vid[0].get("duration") if vid else None)
                if duration is None or float(duration) <= 0:
                    issues.append("Missing or invalid video duration")
                else:
                    video_duration_ms = round(float(duration) * 1000)
            except (OSError, ValueError, subprocess.SubprocessError) as err:
                issues.append(f"Video probe failed: {err}")
    if captions_path is not None:
        if video_duration_ms is None:
            issues.append("Cannot validate caption synchronization without video duration")
        else:
            try:
                issues.extend("Captions: " + problem for problem in validate_srt(captions_path, video_duration_ms))
            except (OSError, UnicodeError) as err:
                issues.append(f"Caption inspection failed: {err}")
    return issues

if __name__ == "__main__":
    problems = verify(sys.argv[1] if len(sys.argv)>1 else ".")
    print(json.dumps({"status": "BLOCKED" if problems else "PASS", "issues": problems}, indent=2))
    sys.exit(bool(problems))
