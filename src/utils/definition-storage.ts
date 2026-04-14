/**
 * 键盘定义文件的存储管理
 * 使用 IndexedDB 存储 QMK 键盘配置
 * 与 FileManager 组件共享存储
 */

import * as IndexedDBStorage from './indexeddb-storage';

export interface KeyboardDefinition {
    name: string;
    vendorId: string;  // 格式: "0x36B0"
    productId: string; // 格式: "0x3118"
    productName?: string;
    matrix: {
        rows: number;
        cols: number;
    };
    layouts: any;
    menus?: any[];
    customKeycodes?: Array<{
        name: string;
        title: string;
        shortName: string;
    }>;
    // 其他定义字段...
    [key: string]: any;
}

/**
 * 将 vendorId 和 productId 转换为 vendorProductId
 * 使用: (vendorId << 16) | productId
 */
export function calculateVendorProductId(vendorId: string, productId: string): number {
    const vid = parseInt(vendorId, 16);
    const pid = parseInt(productId, 16);
    return (vid << 16) | pid;
}

export interface StoredDefinition {
    id: string;
    name: string;
    vendorProductId: number;
    uploadTime: number;
    definition: KeyboardDefinition;
}

/**
 * 获取所有已存储的定义
 */
export async function getStoredDefinitions(): Promise<StoredDefinition[]> {
    try {
        const files = await IndexedDBStorage.getAllFiles();
        const definitions: StoredDefinition[] = [];

        for (const file of files) {
            if (!file.content) continue;
            
            try {
                const definition: KeyboardDefinition = JSON.parse(file.content);
                if (definition.vendorId && definition.productId) {
                    const vendorProductId = calculateVendorProductId(definition.vendorId, definition.productId);
                    definitions.push({
                        id: file.id,
                        name: definition.name || file.name,
                        vendorProductId,
                        uploadTime: file.date ? new Date(file.date).getTime() : Date.now(),
                        definition,
                    });
                }
            } catch (error) {
                console.error('解析配置文件失败:', error);
            }
        }

        return definitions;
    } catch (error) {
        console.error('读取存储的定义失败:', error);
        return [];
    }
}

/**
 * 保存定义到存储
 */
export async function saveDefinition(definition: KeyboardDefinition): Promise<StoredDefinition> {
    try {
        await IndexedDBStorage.saveDefinition(definition);
        
        const vendorProductId = calculateVendorProductId(definition.vendorId, definition.productId);
        
        return {
            id: `${Date.now()}-${Math.random()}`,
            name: definition.name || 'Unknown Keyboard',
            vendorProductId,
            uploadTime: Date.now(),
            definition,
        };
    } catch (error) {
        console.error('保存定义失败:', error);
        throw error;
    }
}

/**
 * 根据 vendorProductId 获取定义
 */
export async function getDefinitionByVendorProductId(vendorProductId: number): Promise<KeyboardDefinition | null> {
    const definitions = await getStoredDefinitions();
    const found = definitions.find(d => d.vendorProductId === vendorProductId);

    if (found) {
        console.log(`[定义存储] 找到本地配置: ${found.name}`);
        return found.definition;
    }

    return null;
}

/**
 * 根据 VID 和 PID 获取定义
 */
export async function getDefinitionByVidPid(vendorId: number, productId: number): Promise<KeyboardDefinition | null> {
    return await IndexedDBStorage.getDefinitionByVidPid(vendorId, productId);
}

/**
 * 删除定义
 */
export async function deleteDefinition(id: string): Promise<void> {
    try {
        await IndexedDBStorage.deleteFile(id);
        console.log(`[定义存储] 删除配置: ${id}`);
    } catch (error) {
        console.error('删除定义失败:', error);
        throw error;
    }
}

/**
 * 清空所有定义
 */
export async function clearAllDefinitions(): Promise<void> {
    try {
        await IndexedDBStorage.clearAllFiles();
        console.log(`[定义存储] 清空所有配置`);
    } catch (error) {
        console.error('清空定义失败:', error);
        throw error;
    }
}

/**
 * 验证定义文件格式
 */
export function validateDefinition(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: '无效的JSON格式' };
    }

    if (!data.name) {
        return { valid: false, error: '缺少 name 字段' };
    }

    if (!data.vendorId) {
        return { valid: false, error: '缺少 vendorId 字段' };
    }

    if (!data.productId) {
        return { valid: false, error: '缺少 productId 字段' };
    }

    if (!data.matrix || !data.matrix.rows || !data.matrix.cols) {
        return { valid: false, error: '缺少 matrix 配置' };
    }

    if (!data.layouts || !data.layouts.keymap) {
        return { valid: false, error: '缺少 layouts.keymap 配置' };
    }

    return { valid: true };
}

/**
 * 从文件读取定义
 */
export function readDefinitionFile(file: File): Promise<KeyboardDefinition> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);

                const validation = validateDefinition(data);
                if (!validation.valid) {
                    reject(new Error(validation.error));
                    return;
                }

                resolve(data as KeyboardDefinition);
            } catch (error) {
                reject(new Error('JSON解析失败: ' + (error as Error).message));
            }
        };

        reader.onerror = () => {
            reject(new Error('文件读取失败'));
        };

        reader.readAsText(file);
    });
}

