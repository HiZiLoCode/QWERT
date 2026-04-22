from __future__ import annotations

import io
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from svgelements import SVG, Shape


SOURCE_SVG = Path(
    r"C:\Users\11485\Documents\xwechat_files\wxid_57b15o6dcd6m22_2ad1\msg\file\2026-04\QK100驱动图标(1).svg"
)
OUTPUT_DIR = Path(r"E:\工具项目\nextjs-mui-i18n\public\KeyType")

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)


def tag_name(el: ET.Element) -> str:
    return el.tag.split("}", 1)[-1]


def has_unwanted_content(group: ET.Element) -> bool:
    for e in group.iter():
        n = tag_name(e)
        if n in {"image", "defs", "clipPath"}:
            return True
        if n == "g" and (e.attrib.get("class") or "").strip() == "st11":
            return True
        if n in {"text", "tspan"}:
            return True
    return False


def extract_style_block(svg_text: str) -> str:
    m = re.search(r"<style[^>]*>.*?</style>", svg_text, flags=re.S)
    return m.group(0) if m else ""


def compute_bbox(style_block: str, group: ET.Element) -> tuple[float, float, float, float] | None:
    group_text = ET.tostring(group, encoding="unicode")
    snippet = (
        f'<svg xmlns="{SVG_NS}" xmlns:xlink="{XLINK_NS}" viewBox="0 0 1058.2 645.4">'
        f"{style_block}"
        f"{group_text}"
        "</svg>"
    )
    svg = SVG.parse(io.StringIO(snippet))
    x_min = y_min = x_max = y_max = None
    for e in svg.elements():
        if not isinstance(e, Shape):
            continue
        bb = e.bbox()
        if bb is None:
            continue
        xmin, ymin, xmax, ymax = bb
        if x_min is None:
            x_min, y_min, x_max, y_max = xmin, ymin, xmax, ymax
        else:
            x_min = min(x_min, xmin)
            y_min = min(y_min, ymin)
            x_max = max(x_max, xmax)
            y_max = max(y_max, ymax)
    if x_min is None:
        return None
    return x_min, y_min, x_max, y_max


def write_icon(style_block: str, group: ET.Element, bbox: tuple[float, float, float, float], out_file: Path) -> None:
    x_min, y_min, x_max, y_max = bbox
    pad = 1.5
    x_min -= pad
    y_min -= pad
    x_max += pad
    y_max += pad
    width = max(1.0, x_max - x_min)
    height = max(1.0, y_max - y_min)

    group_text = ET.tostring(group, encoding="unicode")
    svg_text = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="{SVG_NS}" xmlns:xlink="{XLINK_NS}" viewBox="0 0 {width:.3f} {height:.3f}" '
        f'width="{width:.3f}" height="{height:.3f}">\n'
        f"{style_block}\n"
        f'<g transform="translate({-x_min:.3f} {-y_min:.3f})">\n'
        f"{group_text}\n"
        "</g>\n"
        "</svg>\n"
    )
    out_file.write_text(svg_text, encoding="utf-8")


def main() -> None:
    if not SOURCE_SVG.exists():
        raise FileNotFoundError(f"Source SVG not found: {SOURCE_SVG}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    svg_text = SOURCE_SVG.read_text(encoding="utf-8", errors="ignore")
    style_block = extract_style_block(svg_text)
    root = ET.fromstring(svg_text)

    groups: list[ET.Element] = [child for child in list(root) if tag_name(child) == "g"]
    valid_groups: list[tuple[ET.Element, tuple[float, float, float, float]]] = []
    for g in groups:
        if has_unwanted_content(g):
            continue
        bbox = compute_bbox(style_block, g)
        if bbox is None:
            continue
        x_min, y_min, x_max, y_max = bbox
        if (x_max - x_min) < 12 or (y_max - y_min) < 12:
            continue
        valid_groups.append((g, bbox))

    valid_groups.sort(key=lambda item: (item[1][1], item[1][0]))

    # 先删除旧的 icon_###.svg，避免残留旧编号。
    for p in OUTPUT_DIR.glob("icon_*.svg"):
        p.unlink()

    for idx, (group, bbox) in enumerate(valid_groups, start=1):
        out_file = OUTPUT_DIR / f"icon_{idx:03d}.svg"
        write_icon(style_block, group, bbox, out_file)

    print(f"Exported {len(valid_groups)} icons to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
