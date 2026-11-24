"""Measure local corner displacement in two already aligned, equally framed photos.

python check_junctions.py archive.jpg aligned-modern.jpg
Evaluated with numpy 2.5.5 and opencv-python-headless 5.1.0.95. For repeatable
comparisons, use the same aligned exports: resampling can split or merge edges.
Returns JSON in a common 1000-pixel-wide
frame. dx is positive right, dy positive down, from archive to modern. An empty
match list is an abstention. Matches are geometric candidates, not proof of object
identity. This tool does not register, warp, or modify either photograph.
"""
import argparse
import json
import sys

import cv2
import numpy as np


WIDTH = 1000


def read_gray(path):
    image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError(f"Cannot read image: {path}")
    return image


def segments(image):
    lines = cv2.createLineSegmentDetector().detect(image)[0]
    if lines is None:
        return []
    coords = lines.reshape(-1, 2, 2)
    return coords[np.linalg.norm(coords[:, 1] - coords[:, 0], axis=1) > 32]


def junctions(image):
    lines = segments(image)
    found = []
    if len(lines) < 2:
        return found
    lengths = np.linalg.norm(lines[:, 1] - lines[:, 0], axis=1)
    directions = (lines[:, 1] - lines[:, 0]) / lengths[:, None]
    for i in np.flatnonzero(lengths >= 100):
        start = lines[i, 0]
        u = directions[i]
        for j in np.flatnonzero(lengths < lengths[i]):
            v = directions[j]
            axes = np.column_stack((u, -v))
            if abs(np.linalg.det(axes)) < 0.65:
                continue
            s, t = np.linalg.solve(axes, lines[j, 0] - start)
            if min(abs(s), abs(s - lengths[i])) > 12:
                continue
            if min(abs(t), abs(t - lengths[j])) > 12:
                continue
            point = start + s * u
            if not (0 <= point[0] < image.shape[1] and 0 <= point[1] < image.shape[0]):
                continue
            # Rays point into each segment, discriminating opposite-facing corners.
            long_ray = u if s < lengths[i] / 2 else -u
            short_ray = v if t < lengths[j] / 2 else -v
            if any(np.linalg.norm(point - p) < 8 and long_ray @ a > .96
                   and short_ray @ b > .96 for p, a, b in found):
                continue
            found.append((point, long_ray, short_ray))
    return found


def unique_nearest(costs, index):
    competitors = np.delete(costs, index)
    return not np.any(competitors < costs[index] + 5)


def diagnose(archive, modern):
    height = round(WIDTH * archive.shape[0] / archive.shape[1])
    modern_height = WIDTH * modern.shape[0] / modern.shape[1]
    if abs(height - modern_height) > 1:
        raise ValueError("Different aspect ratios: supply an already aligned export.")
    if height < 1:
        raise ValueError("Image is too wide to sample.")
    old, new = [junctions(cv2.resize(im, (WIDTH, height), interpolation=cv2.INTER_AREA))
                for im in (archive, modern)]
    distances = np.full((len(old), len(new)), np.inf)
    for i, (p, u, v) in enumerate(old):
        for j, (q, w, x) in enumerate(new):
            if u @ w > .985 and v @ x > .985:
                distances[i, j] = np.linalg.norm(q - p)
    matches = []
    for i, row in enumerate(distances):
        if not len(row):
            break
        j = row.argmin()
        if row[j] > 25 or distances[:, j].argmin() != i:
            continue
        if not unique_nearest(row, j) or not unique_nearest(distances[:, j], i):
            continue
        p, q = old[i][0], new[j][0]
        dx, dy = q - p
        matches.append(dict(archive_xy=p.astype(float).round(2).tolist(),
                            modern_xy=q.astype(float).round(2).tolist(),
                            dx=round(float(dx), 2), dy=round(float(dy), 2),
                            over_8px=bool(row[j] > 8)))
    return dict(width=WIDTH, height=height, archive_junctions=len(old),
                modern_junctions=len(new), status="measured" if matches else "abstained",
                matches=matches)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive")
    parser.add_argument("modern")
    args = parser.parse_args()
    try:
        result = diagnose(read_gray(args.archive), read_gray(args.modern))
    except (ValueError, cv2.error) as exc:
        parser.exit(2, f"{exc}\n")
    json.dump(result, sys.stdout, allow_nan=False)
    print()


if __name__ == "__main__":
    main()
