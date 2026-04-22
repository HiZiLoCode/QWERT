from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(r"e:\工具项目\nextjs-mui-i18n")
ICONS_DIR = ROOT / "public" / "KeyType"
CUSTOMKEYS_PATH = ROOT / "src" / "data" / "customkeys.json"


def slugify(name: str) -> str:
    text = name.lower().strip()
    text = text.replace("+", " plus ")
    text = text.replace("-", " ")
    text = text.replace("/", " ")
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "icon"


def icon_filename(group: str, key_name: str, used: set[str]) -> str:
    base = f"{group}_{slugify(key_name)}"
    candidate = f"{base}.svg"
    i = 2
    while candidate in used:
        candidate = f"{base}_{i}.svg"
        i += 1
    used.add(candidate)
    return candidate


def get_group(data: list[dict], label: str) -> dict:
    for group in data:
        if group.get("label") == label:
            return group
    raise ValueError(f"group not found: {label}")


def key_signature(item: dict) -> tuple[int, int, int]:
    return (int(item.get("type", 0)), int(item.get("code1", 0)), int(item.get("code2", 0)))


def main() -> None:
    icon_files = sorted(ICONS_DIR.glob("icon_*.svg"))
    if len(icon_files) != 78:
        raise RuntimeError(f"Expected 78 icon files, got {len(icon_files)}")

    data = json.loads(CUSTOMKEYS_PATH.read_text(encoding="utf-8"))
    mouse = get_group(data, "Mouse")["keycodes"]
    media = get_group(data, "Media")["keycodes"]
    former_custom = get_group(data, "formerCustom")["keycodes"]

    target_keys: list[tuple[str, dict]] = (
        [("mouse", item) for item in mouse]
        + [("media", item) for item in media]
        + [("custom", item) for item in former_custom]
    )
    if len(target_keys) != len(icon_files):
        raise RuntimeError(f"Mapping size mismatch: {len(target_keys)} keys vs {len(icon_files)} icons")

    used_names: set[str] = set()
    signature_to_icon: dict[tuple[int, int, int], str] = {}

    for src_icon, (group_name, key_item) in zip(icon_files, target_keys):
        new_name = icon_filename(group_name, str(key_item.get("name", "")), used_names)
        dst_icon = ICONS_DIR / new_name
        if dst_icon.exists():
            dst_icon.unlink()
        src_icon.rename(dst_icon)
        icon_path = f"/KeyType/{new_name}"
        key_item["icon"] = icon_path
        signature_to_icon[key_signature(key_item)] = icon_path

    # 将同编码键值同步到 Custom / singleCustom，便于当前面板也能直接复用图标。
    for label in ("Custom", "singleCustom"):
        for item in get_group(data, label)["keycodes"]:
            icon = signature_to_icon.get(key_signature(item))
            if icon:
                item["icon"] = icon

    CUSTOMKEYS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=4) + "\n",
        encoding="utf-8",
    )

    print("Renamed 78 icons and updated customkeys.json")


if __name__ == "__main__":
    main()
