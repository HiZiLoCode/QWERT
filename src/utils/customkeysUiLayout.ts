/**
 * 将 `customkeys.json` 中带 `uiKind` 的布局组（如 CustomUiLayout / ShortcutUiLayout）
 * 展开为「分区标题 + 键位」列表，引用仍指向原分组中的完整键定义（不复制 firmware 字段）。
 */

export type KeyItemLike = {
    name: string;
    code: string;
    type: number;
    code1: number;
    code2: number;
    code3?: number;
    langid?: string;
    tooltipLangid?: string;
    icon?: string;
};

export type KeyPoolSection = { isSectionHeader: true; sectionTitleKey: string; code: string };

export type KeyPoolItem = KeyItemLike | KeyPoolSection;

type LayoutRow = {
    uiKind?: string;
    sectionTitleKey?: string;
    refCode?: string;
    refGroup?: string;
    refName?: string;
};

function keyFingerprint(k: KeyItemLike): string {
    return `${k.type}:${k.code1}:${k.code2}:${k.code3 ?? 0}:${k.code}`;
}

function resolveLayoutRef(
    row: LayoutRow,
    pools: Record<string, KeyItemLike[]>,
): KeyItemLike | null {
    if (row.refCode) {
        for (const list of Object.values(pools)) {
            const found = list.find((k) => k.code === row.refCode);
            if (found) return found;
        }
        return null;
    }
    if (row.refGroup && row.refName) {
        const list = pools[row.refGroup];
        if (!list) return null;
        return list.find((k) => k.name === row.refName) ?? null;
    }
    return null;
}

export function expandKeyedPool(options: {
    /** customkeys 根数组 */
    data: unknown[];
    /** 布局组 label，例如 CustomUiLayout */
    layoutLabel: string;
    /** 用于解析 ref 的各分组键列表（Custom 建议用未过滤的完整列表） */
    pools: Record<string, KeyItemLike[]>;
    /** 布局之后按原顺序拼接的列表（如 filteredCustomList） */
    tailList: KeyItemLike[];
    /** 布局中的每一项、以及 tail 中每一项是否展示 */
    itemFilter: (k: KeyItemLike) => boolean;
}): KeyPoolItem[] {
    const { data, layoutLabel, pools, tailList, itemFilter } = options;
    const group = (data as { label?: string; keycodes?: LayoutRow[] }[]).find((g) => g.label === layoutLabel);
    const layoutRows = group?.keycodes;
    if (!Array.isArray(layoutRows) || layoutRows.length === 0) {
        return tailList.filter(itemFilter) as KeyPoolItem[];
    }

    const out: KeyPoolItem[] = [];
    const seen = new Set<string>();

    for (const raw of layoutRows) {
        if (raw.uiKind === 'section' && raw.sectionTitleKey) {
            out.push({
                isSectionHeader: true,
                sectionTitleKey: raw.sectionTitleKey,
                code: `__section__${raw.sectionTitleKey}`,
            });
            continue;
        }
        if (raw.uiKind === 'ref') {
            const key = resolveLayoutRef(raw, pools);
            if (key && itemFilter(key)) {
                out.push(key);
                seen.add(keyFingerprint(key));
            }
        }
    }

    for (const k of tailList) {
        if (!itemFilter(k)) continue;
        if (seen.has(keyFingerprint(k))) continue;
        out.push(k);
    }

    return out;
}
