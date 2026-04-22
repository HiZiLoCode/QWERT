from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(r"e:\工具项目\nextjs-mui-i18n")
ICONS_DIR = ROOT / "public" / "KeyType"
CUSTOMKEYS_PATH = ROOT / "src" / "data" / "customkeys.json"

# 当前文件名与图标内容存在错位，这里按人工核对后的“内容 -> 目标按键名”做修正。
CURRENT_ICON_BY_KEY_NAME = {
    "Volume +": "/KeyType/media_mute.svg",
    "Volume -": "/KeyType/media_volume.svg",
    "Mute": "/KeyType/media_play_pause.svg",
    "Play/Pause": "/KeyType/media_stop.svg",
    "Stop": "/KeyType/media_prev_track.svg",
    "Prev Track": "/KeyType/media_next_track.svg",
    "Next Track": "/KeyType/media_multimedia.svg",
    "Multimedia": "/KeyType/media_homepage.svg",
    "Homepage": "/KeyType/media_web_refresh.svg",
    "Web-Refresh": "/KeyType/media_web_stop.svg",
    "Web-Stop": "/KeyType/media_web_forward.svg",
    "Web-Forward": "/KeyType/media_web_backward.svg",
    "Web-Backward": "/KeyType/media_web_favorites.svg",
    "Web-Favorites": "/KeyType/media_web_search.svg",
    "Web-Search": "/KeyType/media_volume_plus.svg",
    "Calculator": "/KeyType/media_calculator.svg",
    "My Computer": "/KeyType/media_screen_bright.svg",
    "Mail": "/KeyType/media_screen_bright_plus.svg",
    "Screen Bright-": "/KeyType/media_my_computer.svg",
    "Screen Bright+": "/KeyType/media_mail.svg",
}

TARGET_ICON_BY_KEY_NAME = {
    "Volume +": "/KeyType/media_volume_plus.svg",
    "Volume -": "/KeyType/media_volume_minus.svg",
    "Mute": "/KeyType/media_mute.svg",
    "Play/Pause": "/KeyType/media_play_pause.svg",
    "Stop": "/KeyType/media_stop.svg",
    "Prev Track": "/KeyType/media_prev_track.svg",
    "Next Track": "/KeyType/media_next_track.svg",
    "Multimedia": "/KeyType/media_multimedia.svg",
    "Homepage": "/KeyType/media_homepage.svg",
    "Web-Refresh": "/KeyType/media_web_refresh.svg",
    "Web-Stop": "/KeyType/media_web_stop.svg",
    "Web-Forward": "/KeyType/media_web_forward.svg",
    "Web-Backward": "/KeyType/media_web_backward.svg",
    "Web-Favorites": "/KeyType/media_web_favorites.svg",
    "Web-Search": "/KeyType/media_web_search.svg",
    "Calculator": "/KeyType/media_calculator.svg",
    "My Computer": "/KeyType/media_my_computer.svg",
    "Mail": "/KeyType/media_mail.svg",
    "Screen Bright-": "/KeyType/media_screen_bright_minus.svg",
    "Screen Bright+": "/KeyType/media_screen_bright_plus.svg",
}


def main() -> None:
    # 先做文件重命名（两阶段，避免重名覆盖）
    temp_paths: list[tuple[Path, Path]] = []
    final_paths: list[tuple[Path, Path]] = []
    for key_name, current_icon in CURRENT_ICON_BY_KEY_NAME.items():
        src = ROOT / "public" / current_icon.replace("/KeyType/", "KeyType/")
        dst = ROOT / "public" / TARGET_ICON_BY_KEY_NAME[key_name].replace("/KeyType/", "KeyType/")
        if not src.exists():
            raise FileNotFoundError(f"Missing source icon: {src}")
        tmp = src.with_name(src.stem + "__tmp_fix__.svg")
        temp_paths.append((src, tmp))
        final_paths.append((tmp, dst))

    for src, tmp in temp_paths:
        if tmp.exists():
            tmp.unlink()
        src.rename(tmp)
    for tmp, dst in final_paths:
        if dst.exists():
            dst.unlink()
        tmp.rename(dst)

    # 再更新 customkeys.json 里的 Media 分组 icon 路径
    data = json.loads(CUSTOMKEYS_PATH.read_text(encoding="utf-8"))
    for group in data:
        if group.get("label") != "Media":
            continue
        for item in group.get("keycodes", []):
            name = item.get("name")
            if name in TARGET_ICON_BY_KEY_NAME:
                item["icon"] = TARGET_ICON_BY_KEY_NAME[name]
        break

    CUSTOMKEYS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=4) + "\n",
        encoding="utf-8",
    )
    print("Fixed media icon naming and updated customkeys.json")


if __name__ == "__main__":
    main()
