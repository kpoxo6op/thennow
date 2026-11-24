"""Compare final-frame outline agreement on public fixtures or a local image pair."""

import argparse
import io
import json
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import distance_transform_edt, gaussian_filter, maximum_filter

ROOT = Path(__file__).resolve().parents[2]
PUBLISHED = "d9e53835de2e0ed41c594439137a28c39a09615d"
REJECTIONS = ("0006-tamaki-road-board-offices", "0014-bradley-lane-line-road")
OFFSETS = (-16, 0, 16)


def oriented_edges(image, size):
    gray = ImageOps.fit(image.convert("L"), size, method=Image.Resampling.LANCZOS)
    pixels = np.asarray(gray, dtype=float)
    dx = gaussian_filter(pixels, 1.5, order=(0, 1))
    dy = gaussian_filter(pixels, 1.5, order=(1, 0))
    magnitude = np.hypot(dx, dy)
    orientation = np.round(np.arctan2(dy, dx) * 4 / np.pi).astype(int) % 4
    threshold = np.percentile(magnitude, 85)
    for direction, window in enumerate(((1, 3), (2, 2), (3, 1), (2, 2))):
        yield ((orientation == direction) & (magnitude > 0)
               & (magnitude >= threshold)
               & (magnitude == maximum_filter(magnitude, size=window)))


def evaluate(archive, modern, aspect):
    width = 640
    height = max(1, round(width / aspect))
    size = (width, height)
    hits = []
    cells = []
    for source, target in zip(oriented_edges(archive, size), oriented_edges(modern, size)):
        y, x = np.where(source)
        inside = (x >= 24) & (x < width - 24) & (y >= 24) & (y < height - 24)
        x, y = x[inside], y[inside]
        distance = distance_transform_edt(~target) if target.any() else np.full(target.shape, np.inf)
        hits.append([distance[y + dy, x + dx] <= 3 for dy in OFFSETS for dx in OFFSETS])
        cells.append(x * 3 // width + 3 * (y * 2 // height))

    cells = np.concatenate(cells)
    if not cells.size:
        return "n/a     ------"
    hits = np.concatenate(hits, axis=1)
    votes = []
    for cell in range(6):
        region = hits[:, cells == cell]
        if not region.shape[1]:
            votes.append("-")
            continue
        scores = region.sum(axis=1)
        votes.append("1" if scores[4] > np.delete(scores, 4).max() else "0")
    return f"{hits[4].mean():6.1%}  {''.join(votes)}"


def public_pair(metadata_path, revision=None, report=False):
    folder = metadata_path.parent
    if not re.fullmatch(r"[a-z0-9-]+", folder.name):
        raise ValueError("Invalid public catalogue directory")

    def read(path):
        if revision:
            return subprocess.check_output(["git", "show", f"{revision}:{path}"], cwd=ROOT)
        resolved = (ROOT / path).resolve()
        if resolved.parent != ROOT / folder:
            raise ValueError("Expected a file inside its public catalogue directory")
        return resolved.read_bytes()

    metadata = json.loads(read(metadata_path))
    if not metadata.get("a_imageUrl"):
        return

    def image_bytes(field):
        path = Path("public" + metadata[field])
        if path.parent != folder:
            raise ValueError("Expected a public catalogue image")
        return read(path)

    label = "Nov 11 rejection" if revision else "current"
    old_bytes = image_bytes("b_imageUrl")
    new_bytes = image_bytes("a_imageUrl")
    with Image.open(io.BytesIO(old_bytes)) as archive, Image.open(io.BytesIO(new_bytes)) as modern:
        size = (metadata["w"], metadata["h"])
        result = evaluate(archive, modern, size[0] / size[1])
        if report:
            import cv2
            from check_junctions import diagnose

            frames = []
            for data in (old_bytes, new_bytes):
                frame = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_GRAYSCALE)
                if frame is None:
                    raise ValueError("Cannot decode public image")
                if frame.shape[::-1] != size:
                    frame = np.asarray(ImageOps.fit(Image.fromarray(frame), size,
                                                    method=Image.Resampling.LANCZOS))
                frames.append(frame)
            # Feed both diagnostics the same display crop, including the oversized archive scan.
            with tempfile.TemporaryDirectory() as directory:
                paths = [Path(directory) / name for name in ("archive.png", "modern.png")]
                for frame, frame_path in zip(frames, paths):
                    Image.fromarray(frame).save(frame_path)
                fit = json.loads(subprocess.check_output(
                    ["node", "--experimental-strip-types", "scripts/rephoto/replay-fit.mjs", *paths],
                    cwd=ROOT, text=True))
            diagnosis = diagnose(*frames)
            matches = diagnosis["matches"]
            overlap, votes = result.split()
            print(f"| {folder.name} | {label} | {overlap} | `{votes}` | "
                  f"{diagnosis['status']} | {diagnosis['archive_junctions']} / "
                  f"{diagnosis['modern_junctions']} | {len(matches)} | "
                  f"{sum(m['over_8px'] for m in matches)} | {fit['base']} / {fit['embedded']} | "
                  f"{fit['worstCornerPx'] if fit['worstCornerPx'] is not None else '—'} |")
        else:
            print(f"{result}  {metadata['slug']} ({label})")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--pair", nargs=2, metavar=("ARCHIVE", "MODERN"),
                      help="evaluate only these local files at the modern aspect ratio")
    mode.add_argument("--public-report", action="store_true",
                      help="print a Markdown report for public pairs using both diagnostics")
    args = parser.parse_args()
    if args.public_report:
        print("## Public photographic alignment diagnostics\n")
        print("Outline votes cover six regions at 640 px width. Junction displacements "
              "use 1000 px width. Scores and counts are diagnostic observations.\n")
        print("| Place | Capture | Outline agreement | Votes | Junction status | Corners (then / now) | "
              "Matched corners | Matches over 8 px | Model fit (original / padded) | Recovery error (px) |")
        print("|---|---|---:|:---:|---|---:|---:|---:|---|---:|")
    else:
        print("overlap  votes   pair")
    if args.pair:
        with Image.open(args.pair[0]) as archive, Image.open(args.pair[1]) as modern:
            print(evaluate(archive, modern, modern.width / modern.height), " local pair")
        return
    for path in sorted((ROOT / "public/posts").glob("*/*.json")):
        public_pair(path.relative_to(ROOT), report=args.public_report)
    for folder in REJECTIONS:
        public_pair(Path(f"public/posts/{folder}/{folder}.json"), PUBLISHED, args.public_report)


if __name__ == "__main__":
    main()
