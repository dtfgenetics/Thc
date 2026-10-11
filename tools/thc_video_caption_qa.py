"""Validate SRT caption timings before THC releases."""
import re
from pathlib import Path
TS=re.compile(r'^(\d{2}):(\d{2}):(\d{2}),(\d{3})$')
def parse_stamp(s):
    match=TS.fullmatch(s)
    if not match: raise ValueError("bad timestamp")
    h,m,sec,ms=map(int,match.groups())
    if m>=60 or sec>=60: raise ValueError("bad time range")
    return ((h*60+m)*60+sec)*1000+ms
def validate_srt(path,duration_ms):
    text=Path(path).read_text(encoding="utf-8-sig").replace("\r\n","\n").strip()
    if not text: return ["empty captions"]
    issues=[];last=0
    for n,block in enumerate(re.split(r'\n\s*\n',text),1):
        lines=block.splitlines()
        if len(lines)<3 or lines[0].strip()!=str(n):
            issues.append(f"cue {n}: missing number or text");continue
        parts=lines[1].split(" --> ")
        if len(parts)!=2:
            issues.append(f"cue {n}: bad delimiter");continue
        try: start,end=map(parse_stamp,parts)
        except ValueError:
            issues.append(f"cue {n}: invalid timestamp");continue
        if start<last: issues.append(f"cue {n}: overlap")
        if end<=start: issues.append(f"cue {n}: invalid duration")
        if end>duration_ms+250: issues.append(f"cue {n}: beyond video")
        if end-start>8500: issues.append(f"cue {n}: too long")
        if len(lines[2:])>2 or any(len(s)>48 for s in lines[2:]): issues.append(f"cue {n}: readability")
        last=end
    return issues
