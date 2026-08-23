#!/usr/bin/env python3
"""Build web-optimized derivatives for DTFSeeds educational images.

Canonical source images remain untouched. This script creates responsive WebP
previews for browsing/lesson cards, rewrites the infographic library's <img>
sources to those previews, and keeps each card's <a href> pointed at the full
canonical source image.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps, UnidentifiedImageError

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
DEFAULT_WIDTHS = (640, 1280)
DEFAULT_QUALITY = 82
ASSET_PREFIX = "/assets/education/infographics/"
PREVIEW_PREFIX = "/assets/education/infographics-web/"


@dataclass(frozen=True)
class Derivative:
    filename: str
    width: int
    height: int
    bytes: int


@dataclass(frozen=True)
class ImageRecord:
    source: str
    source_width: int
    source_height: int
    source_bytes: int
    sha256: str
    derivatives: tuple[Derivative, ...]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--library-page", required=True, type=Path)
    parser.add_argument("--library-json", required=True, type=Path)
    parser.add_argument("--library-output", required=True, type=Path)
    parser.add_argument("--quality", type=int, default=DEFAULT_QUALITY)
    parser.add_argument("--widths", nargs="+", type=int, default=list(DEFAULT_WIDTHS))
    return parser.parse_args()


def source_images(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def derivative_name(source: Path, width: int) -> str:
    return f"{source.stem}-{width}.webp"


def build_derivatives(path: Path, output: Path, widths: list[int], quality: int) -> ImageRecord:
    source_size = path.stat().st_size
    try:
        with Image.open(path) as opened:
            image = ImageOps.exif_transpose(opened)
            image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise RuntimeError(f"Unreadable image: {path}: {exc}") from exc

    source_width, source_height = image.size
    if source_width < 1 or source_height < 1:
        raise RuntimeError(f"Invalid dimensions for {path}: {image.size}")

    if "A" in image.getbands():
        image = image.convert("RGBA")
    else:
        image = image.convert("RGB")

    target_widths = sorted({min(source_width, width) for width in widths if width > 0})
    if not target_widths:
        target_widths = [source_width]

    derivatives: list[Derivative] = []
    output.mkdir(parents=True, exist_ok=True)
    for target_width in target_widths:
        target_height = max(1, round(source_height * target_width / source_width))
        if target_width == source_width:
            resized = image.copy()
        else:
            resized = image.resize((target_width, target_height), Image.Resampling.LANCZOS)

        name = derivative_name(path, target_width)
        destination = output / name
        resized.save(
            destination,
            format="WEBP",
            quality=quality,
            method=6,
            optimize=True,
        )
        derivatives.append(
            Derivative(
                filename=name,
                width=target_width,
                height=target_height,
                bytes=destination.stat().st_size,
            )
        )

    return ImageRecord(
        source=path.name,
        source_width=source_width,
        source_height=source_height,
        source_bytes=source_size,
        sha256=sha256(path),
        derivatives=tuple(derivatives),
    )


def optimize_img_tag(tag: str, record: ImageRecord) -> str:
    derivatives = sorted(record.derivatives, key=lambda item: item.width)
    first = derivatives[0]
    first_url = PREVIEW_PREFIX + first.filename
    srcset = ", ".join(f"{PREVIEW_PREFIX}{item.filename} {item.width}w" for item in derivatives)
    sizes = "(max-width: 700px) 92vw, (max-width: 1100px) 46vw, 30vw"

    tag = re.sub(r'\bsrc="[^"]+"', f'src="{first_url}"', tag, count=1)
    if " srcset=" not in tag:
        tag = tag[:-1] + f' srcset="{srcset}" sizes="{sizes}">'
    if " decoding=" not in tag:
        tag = tag[:-1] + ' decoding="async">'
    return tag


def rewrite_library(html: str, records: dict[str, ImageRecord]) -> tuple[str, int, list[str]]:
    pattern = re.compile(
        r'<img\b[^>]*\bsrc="' + re.escape(ASSET_PREFIX) + r'([^"]+)"[^>]*>',
        flags=re.IGNORECASE,
    )
    replaced = 0
    missing: list[str] = []

    def replace(match: re.Match[str]) -> str:
        nonlocal replaced
        filename = match.group(1)
        record = records.get(filename)
        if record is None:
            missing.append(filename)
            return match.group(0)
        replaced += 1
        return optimize_img_tag(match.group(0), record)

    return pattern.sub(replace, html), replaced, missing


def main() -> int:
    args = parse_args()
    if not args.source.is_dir():
        raise RuntimeError(f"Source directory does not exist: {args.source}")
    if not 1 <= args.quality <= 100:
        raise RuntimeError("--quality must be between 1 and 100")

    images = list(source_images(args.source))
    if not images:
        raise RuntimeError(f"No supported images found in {args.source}")

    args.output.mkdir(parents=True, exist_ok=True)
    args.library_output.mkdir(parents=True, exist_ok=True)

    records: list[ImageRecord] = []
    seen_names: set[str] = set()
    for image in images:
        if image.name in seen_names:
            raise RuntimeError(f"Duplicate canonical filename: {image.name}")
        seen_names.add(image.name)
        records.append(build_derivatives(image, args.output, args.widths, args.quality))

    record_map = {record.source: record for record in records}
    library_html = args.library_page.read_text(encoding="utf-8")
    optimized_html, replaced, missing = rewrite_library(library_html, record_map)
    if replaced == 0:
        raise RuntimeError("No infographic image references were optimized in the library page")
    if missing:
        raise RuntimeError("Library references missing canonical images: " + ", ".join(sorted(set(missing))))

    (args.library_output / "index.html").write_text(optimized_html, encoding="utf-8")

    library_data = json.loads(args.library_json.read_text(encoding="utf-8"))
    library_data["webOptimization"] = {
        "previewAssetBase": PREVIEW_PREFIX,
        "previewFormat": "webp",
        "previewWidths": sorted(set(args.widths)),
        "quality": args.quality,
        "fullResolutionLinksPreserved": True,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }
    (args.library_output / "library.json").write_text(
        json.dumps(library_data, indent=2) + "\n", encoding="utf-8"
    )

    total_source = sum(record.source_bytes for record in records)
    total_preview = sum(max(record.derivatives, key=lambda item: item.width).bytes for record in records)
    savings = 0.0 if total_source == 0 else (1 - total_preview / total_source) * 100

    manifest = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "canonicalSource": str(args.source),
        "previewAssetBase": PREVIEW_PREFIX,
        "quality": args.quality,
        "requestedWidths": sorted(set(args.widths)),
        "sourceImageCount": len(records),
        "libraryImagesOptimized": replaced,
        "sourceBytes": total_source,
        "largestPreviewBytes": total_preview,
        "estimatedLargestPreviewSavingsPercent": round(savings, 2),
        "images": [
            {
                **{k: v for k, v in asdict(record).items() if k != "derivatives"},
                "derivatives": [asdict(item) for item in record.derivatives],
            }
            for record in records
        ],
    }
    (args.output / "optimization-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    (args.library_output / "optimization-manifest.json").write_text(
        json.dumps({k: v for k, v in manifest.items() if k != "images"}, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"Optimized {len(records)} canonical images; rewrote {replaced} library image tags; "
        f"largest-preview byte reduction {savings:.1f}%"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
