"""Inventory THC source footage without approving its rights or scientific authenticity."""
import hashlib, json, subprocess, sys
from pathlib import Path
VIDEO={".mp4",".mov",".webm",".mkv"}
IMAGE={".jpg",".jpeg",".png",".webp",".tif",".tiff"}
AUDIO={".wav",".flac",".aiff",".mp3",".m4a"}
def inspect_file(path, root):
    root=Path(root).resolve()
    original=Path(path).absolute()
    if any(part.is_symlink() for part in (original, *original.parents)):
        raise ValueError("symlink media not allowed")
    path=original.resolve()
    if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size==0:
        raise ValueError("missing, empty or unsafe file")
    ext=path.suffix.lower()
    kind="video" if ext in VIDEO else "image" if ext in IMAGE else "audio" if ext in AUDIO else None
    if kind is None: raise ValueError("unsupported media type")
    digest=hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b""): digest.update(chunk)
    try:
        output=subprocess.run(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(path)],capture_output=True,text=True,check=True,timeout=30)
        metadata=json.loads(output.stdout)
    except (OSError,ValueError,subprocess.SubprocessError) as exc:
        raise ValueError("not valid probed media") from exc
    streams=metadata.get("streams",[])
    if not any(stream.get("codec_type")==("video" if kind=="image" else kind) for stream in streams):
        raise ValueError("media streams inconsistent with file type")
    return {"path":str(path.relative_to(root)),"type":kind,"bytes":path.stat().st_size,
            "sha256":digest.hexdigest(),"streams":[{key:s.get(key) for key in ("codec_type","codec_name","width","height","sample_rate") if s.get(key) is not None} for s in streams],
            "duration_seconds":metadata.get("format",{}).get("duration"),
            "rights":"UNVERIFIED","provenance":"UNVERIFIED",
            "human_voice":"NOT_ASSESSED","release_eligible":False}
def inventory(root):
    root=Path(root).resolve()
    files=sorted(p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in VIDEO|IMAGE|AUDIO and not p.is_symlink())
    assets=[]; rejected=[]
    for path in files:
        try:
            assets.append(inspect_file(path,root))
        except ValueError as exc:
            rejected.append({"path":str(path.relative_to(root)),"reason":str(exc)})
    return {"schema_version":2,"warning":"Technical checks do not verify rights, biological accuracy or genuine human narration.",
            "assets":assets,"rejected":rejected}
if __name__=="__main__":
    print(json.dumps(inventory(sys.argv[1] if len(sys.argv)>1 else "."),indent=2))
