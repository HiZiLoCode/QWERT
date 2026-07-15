/**
 * IndexedDB 存储管理
 * - keyboard_configs: 屏幕主题等媒体资源
 * - qmk_definitions: QMK 键盘配置文件（本地配置管理专用）
 */

const DB_NAME = 'KeyboardConfigDB';
const DB_VERSION = 2;
/** 屏幕主题、相册等媒体资源 */
const STORE_ASSETS = 'keyboard_configs';
/** QMK 键盘定义 JSON，与媒体资源隔离 */
const STORE_QMK = 'qmk_definitions';
const QMK_MIGRATION_KEY = 'KeyboardConfigDB_qmk_migrated_v2';

export interface FileItem {
    id: string;
    name: string;
    type: 'file';
    size?: number;
    date?: string;
    content?: string;
}

export interface KeyboardDefinition {
    name: string;
    vendorId: string;
    productId: string;
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
    [key: string]: any;
}

function isQmkDefinitionContent(content: string): boolean {
    try {
        const data = JSON.parse(content);
        return !!(
            data &&
            typeof data === 'object' &&
            data.name &&
            data.vendorId &&
            data.productId &&
            data.matrix?.rows &&
            data.matrix?.cols &&
            data.layouts?.keymap
        );
    } catch {
        return false;
    }
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[IndexedDB] 打开数据库失败:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_ASSETS)) {
                const assetStore = db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
                assetStore.createIndex('name', 'name', { unique: false });
                assetStore.createIndex('date', 'date', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_QMK)) {
                const qmkStore = db.createObjectStore(STORE_QMK, { keyPath: 'id' });
                qmkStore.createIndex('name', 'name', { unique: false });
                qmkStore.createIndex('date', 'date', { unique: false });
                console.log('[IndexedDB] QMK 配置存储创建成功');
            }
        };
    });
}

function runStoreRequest<T>(
    storeName: string,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    return openDB().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const transaction = db.transaction([storeName], mode);
                const objectStore = transaction.objectStore(storeName);
                const request = run(objectStore);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
                transaction.oncomplete = () => db.close();
            })
    );
}

// ---------------------------------------------------------------------------
// 屏幕主题 / 媒体资源（keyboard_configs）
// ---------------------------------------------------------------------------

export async function saveFile(file: FileItem): Promise<void> {
    await runStoreRequest(STORE_ASSETS, 'readwrite', (store) => store.put(file));
    console.log('[IndexedDB] 媒体文件保存成功:', file.name);
}

export async function getAllFiles(): Promise<FileItem[]> {
    const files = await runStoreRequest<FileItem[]>(STORE_ASSETS, 'readonly', (store) => store.getAll());
    return files || [];
}

export async function getFileById(id: string): Promise<FileItem | null> {
    const file = await runStoreRequest<FileItem | undefined>(STORE_ASSETS, 'readonly', (store) => store.get(id));
    return file ?? null;
}

export async function deleteFile(id: string): Promise<void> {
    await runStoreRequest(STORE_ASSETS, 'readwrite', (store) => store.delete(id));
    console.log('[IndexedDB] 媒体文件删除成功:', id);
}

export async function clearAllFiles(): Promise<void> {
    await runStoreRequest(STORE_ASSETS, 'readwrite', (store) => store.clear());
    console.log('[IndexedDB] 所有媒体文件已清空');
}

// ---------------------------------------------------------------------------
// QMK 键盘定义（qmk_definitions）
// ---------------------------------------------------------------------------

async function saveQmkFileItem(file: FileItem): Promise<void> {
    await runStoreRequest(STORE_QMK, 'readwrite', (store) => store.put(file));
}

let migrationPromise: Promise<void> | null = null;

async function migrateQmkFromLegacyStore(): Promise<void> {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(QMK_MIGRATION_KEY)) {
        return;
    }

    const legacyFiles = await getAllFiles();
    const existingQmk = await runStoreRequest<FileItem[]>(STORE_QMK, 'readonly', (store) => store.getAll());
    const existingIds = new Set((existingQmk || []).map((f) => f.id));

    for (const file of legacyFiles) {
        if (!file.content || !isQmkDefinitionContent(file.content)) {
            continue;
        }

        if (!existingIds.has(file.id)) {
            await saveQmkFileItem(file);
            console.log('[IndexedDB] 迁移 QMK 配置:', file.name);
        }

        await deleteFile(file.id);
    }

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(QMK_MIGRATION_KEY, '1');
    }
}

async function ensureQmkMigration(): Promise<void> {
    if (!migrationPromise) {
        migrationPromise = migrateQmkFromLegacyStore().catch((error) => {
            migrationPromise = null;
            console.error('[IndexedDB] QMK 配置迁移失败:', error);
            throw error;
        });
    }
    await migrationPromise;
}

export async function getAllQmkDefinitions(): Promise<FileItem[]> {
    await ensureQmkMigration();
    const files = await runStoreRequest<FileItem[]>(STORE_QMK, 'readonly', (store) => store.getAll());
    console.log('[IndexedDB] 获取 QMK 配置:', (files || []).length, '个');
    return files || [];
}

export async function deleteQmkDefinition(id: string): Promise<void> {
    await runStoreRequest(STORE_QMK, 'readwrite', (store) => store.delete(id));
    console.log('[IndexedDB] QMK 配置删除成功:', id);
}

export async function clearAllQmkDefinitions(): Promise<void> {
    await runStoreRequest(STORE_QMK, 'readwrite', (store) => store.clear());
    console.log('[IndexedDB] 所有 QMK 配置已清空');
}

export async function getDefinitionByVidPid(vendorId: number, productId: number): Promise<KeyboardDefinition | null> {
    const files = await getAllQmkDefinitions();

    for (const file of files) {
        if (!file.content) continue;

        try {
            const definition: KeyboardDefinition = JSON.parse(file.content);
            const vid = parseInt(definition.vendorId, 16);
            const pid = parseInt(definition.productId, 16);

            if (vid === vendorId && pid === productId) {
                console.log('[IndexedDB] 找到匹配的配置:', definition.name);
                return definition;
            }
        } catch (error) {
            console.error('[IndexedDB] 解析配置失败:', error);
        }
    }

    return null;
}

export async function saveDefinition(definition: KeyboardDefinition): Promise<void> {
    await ensureQmkMigration();

    const files = await getAllQmkDefinitions();
    const vid = parseInt(definition.vendorId, 16);
    const pid = parseInt(definition.productId, 16);

    let existingFile: FileItem | null = null;
    for (const file of files) {
        if (!file.content) continue;

        try {
            const def: KeyboardDefinition = JSON.parse(file.content);
            const fVid = parseInt(def.vendorId, 16);
            const fPid = parseInt(def.productId, 16);

            if (fVid === vid && fPid === pid) {
                existingFile = file;
                break;
            }
        } catch {
            // 忽略解析错误
        }
    }

    const content = JSON.stringify(definition, null, 2);
    const fileName = `${definition.name || 'keyboard'}.json`;

    const fileItem: FileItem = {
        id: existingFile?.id || `${Date.now()}-${Math.random()}`,
        name: fileName,
        type: 'file',
        size: content.length,
        date: new Date().toISOString(),
        content,
    };

    await saveQmkFileItem(fileItem);

    if (existingFile) {
        console.log('[IndexedDB] 更新 QMK 配置:', definition.name);
    } else {
        console.log('[IndexedDB] 添加 QMK 配置:', definition.name);
    }
}
