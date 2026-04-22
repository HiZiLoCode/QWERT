from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(r"e:\工具项目\nextjs-mui-i18n")
CUSTOMKEYS_PATH = ROOT / "src" / "data" / "customkeys.json"


def icon(path: str) -> str:
    return f"/KeyType/{path}.svg"


FORMER_MAP = {
    "MO0": icon("custom_mo0"),
    "MO1": icon("custom_mo1"),
    "MO2": icon("custom_mo2"),
    "MO3": icon("custom_mo3"),
    "TO0": icon("custom_to0"),
    "TO1": icon("custom_to1"),
    "TO2": icon("custom_to2"),
    "TO3": icon("custom_to3"),
    "BL_TOG": icon("custom_bl_tog"),
    "BL_MOD": icon("custom_bl_mod"),
    "BL_RMOD": icon("custom_bl_rmod"),
    "BL_HUI": icon("custom_bl_hui"),
    "BL_HUD": icon("custom_bl_hud"),
    "BL_VAI": icon("custom_bl_vai"),
    "BL_VAD": icon("custom_bl_vad"),
    "BL_SPI": icon("custom_bl_spi"),
    "BL_SPD": icon("custom_bl_spd"),
    "BL_DEFINE1": icon("custom_bl_define1"),
    "BL_DEFINE2": icon("custom_bl_define2"),
    "BL_DEFINE3": icon("custom_bl_define3"),
    "BL_DEFINE4": icon("custom_bl_define4"),
    "BL_DEFINE5": icon("custom_bl_define5"),
    "LG_TOG": icon("custom_lg_tog"),
    "LG_MOD": icon("custom_lg_mod"),
    "LG_RMOD": icon("custom_lg_rmod"),
    "LG_HUI": icon("custom_lg_hui"),
    "LG_HUD": icon("custom_lg_hud"),
    "LG_VAI": icon("custom_lg_vai"),
    "LG_VAD": icon("custom_lg_vad"),
    "LG_SPI": icon("custom_lg_spi"),
    "LG_SPD": icon("custom_lg_spd"),
    "SD_TOG": icon("custom_sd_tog"),
    "SD_MOD": icon("custom_sd_mod"),
    "SD_RMOD": icon("custom_sd_rmod"),
    "SD_HUI": icon("custom_sd_hui"),
    "SD_HUD": icon("custom_sd_hud"),
    "SD_VAI": icon("custom_sd_vai"),
    "SD_VAD": icon("custom_sd_vad"),
    "SD_SPI": icon("custom_sd_spi"),
    "SD_SPD": icon("custom_sd_spd"),
    "KYE_RESET": icon("custom_kye_reset"),
    "MODE_BLE1": icon("custom_mode_ble1"),
    "MODE_BLE2": icon("custom_mode_ble2"),
    "MODE_BLE3": icon("custom_mode_ble3"),
    "MODE_2P4G": icon("custom_mode_2p4g"),
    "MODE_USB": icon("custom_mode_usb"),
    "BATT_STATUS": icon("custom_batt_status"),
    "KYE_SIX_NCH": icon("custom_kye_six_nch"),
    "KYE_WIN_LOCK_SET": icon("custom_kye_win_lock_set"),
    "KYE_WASD_SET": icon("custom_kye_wasd_set"),
    "KYE_SCAK_DELAY_SET": icon("custom_kye_scak_delay_set"),
}

SINGLE_MAP = {
    "MO0": icon("custom_mo0"),
    "MO1": icon("custom_mo1"),
    "MO2": icon("custom_mo2"),
    "MO3": icon("custom_mo3"),
    "TO0": icon("custom_to0"),
    "TO1": icon("custom_to1"),
    "TO2": icon("custom_to2"),
    "TO3": icon("custom_to3"),
    "BL_TOG": icon("custom_bl_tog"),
    "BL_MOD": icon("custom_bl_mod"),
    "BL_RMOD": icon("custom_bl_rmod"),
    "BL_HUI": icon("custom_bl_hui"),
    "BL_HUD": icon("custom_bl_hud"),
    "BL_VAI": icon("custom_bl_vai"),
    "BL_VAD": icon("custom_bl_vad"),
    "BL_SPI": icon("custom_bl_spi"),
    "BL_SPD": icon("custom_bl_spd"),
    "BL_DEFINE": icon("custom_bl_define1"),
    "LG_TOG": icon("custom_lg_tog"),
    "LG_MOD": icon("custom_lg_mod"),
    "LG_RMOD": icon("custom_lg_rmod"),
    "LG_HUI": icon("custom_lg_hui"),
    "LG_HUD": icon("custom_lg_hud"),
    "LG_VAI": icon("custom_lg_vai"),
    "LG_VAD": icon("custom_lg_vad"),
    "LG_SPI": icon("custom_lg_spi"),
    "LG_SPD": icon("custom_lg_spd"),
    "SD_TOG": icon("custom_sd_tog"),
    "SD_MOD": icon("custom_sd_mod"),
    "SD_RMOD": icon("custom_sd_rmod"),
    "SD_HUI": icon("custom_sd_hui"),
    "SD_HUD": icon("custom_sd_hud"),
    "SD_VAI": icon("custom_sd_vai"),
    "SD_VAD": icon("custom_sd_vad"),
    "SD_SPI": icon("custom_sd_spi"),
    "SD_SPD": icon("custom_sd_spd"),
    "KYE_RESET": icon("custom_kye_reset"),
    "KYE_SIX_NCH": icon("custom_kye_six_nch"),
    "KYE_MAC_WINCH": "💻🪟",
    "KYE_WIN_LOCK_SET": icon("custom_kye_win_lock_set"),
    "KYE_WASD_SET": icon("custom_kye_wasd_set"),
    "KYE_SCAK_DELAY_SET": icon("custom_kye_scak_delay_set"),
}

CUSTOM_MAP = {
    "Fn0": icon("custom_mo0"),
    "Fn1": icon("custom_mo1"),
    "Fn2": icon("custom_mo2"),
    "Fn3": icon("custom_mo3"),
    "To0": icon("custom_to0"),
    "To1": icon("custom_to1"),
    "To2": icon("custom_to2"),
    "To3": icon("custom_to3"),
    "Key Light Toggle": icon("custom_bl_tog"),
    "Key Light Mode +": icon("custom_bl_mod"),
    "Key Light Mode -": icon("custom_bl_rmod"),
    "Key Light Hue +": icon("custom_bl_hui"),
    "Key Light Hue -": icon("custom_bl_hud"),
    "Key Light Bright +": icon("custom_bl_vai"),
    "Key Light Bright -": icon("custom_bl_vad"),
    "Key Light Speed +": icon("custom_bl_spi"),
    "Key Light Speed -": icon("custom_bl_spd"),
    "Color Board": "🎨",
    "Custom Light 1": icon("custom_bl_define1"),
    "Custom Light 2": icon("custom_bl_define2"),
    "Custom Light 3": icon("custom_bl_define3"),
    "Custom Light 4": icon("custom_bl_define4"),
    "Custom Light 5": icon("custom_bl_define5"),
    "Logo Light Toggle": icon("custom_lg_tog"),
    "Logo Light Mode +": icon("custom_lg_mod"),
    "Logo Light Mode -": icon("custom_lg_rmod"),
    "Logo Light Hue +": icon("custom_lg_hui"),
    "Logo Light Hue -": icon("custom_lg_hud"),
    "Logo Ligh Bright +": icon("custom_lg_vai"),
    "Logo Light Bright -": icon("custom_lg_vad"),
    "Logo Light Speed +": icon("custom_lg_spi"),
    "Logo Light Speed -": icon("custom_lg_spd"),
    "Side Light Toggle": icon("custom_sd_tog"),
    "Side Light Mode +": icon("custom_sd_mod"),
    "Side Light Mode -": icon("custom_sd_rmod"),
    "Side Light Hue +": icon("custom_sd_hui"),
    "Side Light Hue -": icon("custom_sd_hud"),
    "Side Light Bright +": icon("custom_sd_vai"),
    "Side Light Bright -": icon("custom_sd_vad"),
    "Side Light Speed +": icon("custom_sd_spi"),
    "Side Light Speed -": icon("custom_sd_spd"),
    "Matrix Light Toggle": "💡🔲",
    "Matrix Light Mode +": "💡🔲➕",
    "Matrix Light Mode -": "💡🔲➖",
    "Matrix Light Hue +": "🌈🔲➕",
    "Matrix Light Hue -": "🌈🔲➖",
    "Matrix Light Bright +": "🔆🔲➕",
    "Matrix Light Bright -": "🔆🔲➖",
    "Matrix Light Speed +": "⚡🔲➕",
    "Matrix Light Speed -": "⚡🔲➖",
    "Reset": icon("custom_kye_reset"),
    "BLE Mode1": icon("custom_mode_ble1"),
    "BLE Mode2": icon("custom_mode_ble2"),
    "BLE Mode3": icon("custom_mode_ble3"),
    "2.4G Mode": icon("custom_mode_2p4g"),
    "USB Mode": icon("custom_mode_usb"),
    "Battery Status": icon("custom_batt_status"),
    "6K/NK Toggle": icon("custom_kye_six_nch"),
    "MAC/Win Toggle": "💻🪟",
    "Win Lock Toggle": icon("custom_kye_win_lock_set"),
    "WASD Toggle": icon("custom_kye_wasd_set"),
    "Key Delay Toggle": icon("custom_kye_scak_delay_set"),
}


def remap(group: dict, mapping: dict[str, str]) -> None:
    for item in group.get("keycodes", []):
        name = item.get("name")
        if name in mapping:
            item["icon"] = mapping[name]


def main() -> None:
    data = json.loads(CUSTOMKEYS_PATH.read_text(encoding="utf-8"))
    by_label = {g.get("label"): g for g in data}

    remap(by_label["formerCustom"], FORMER_MAP)
    remap(by_label["singleCustom"], SINGLE_MAP)
    remap(by_label["Custom"], CUSTOM_MAP)

    CUSTOMKEYS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=4) + "\n",
        encoding="utf-8",
    )
    print("Fixed icon mapping for Custom/formerCustom/singleCustom")


if __name__ == "__main__":
    main()
