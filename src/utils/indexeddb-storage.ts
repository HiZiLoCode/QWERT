/**
 * IndexedDB 存储管理
 * 用于存储键盘配置文件
 */

const DB_NAME = 'KeyboardConfigDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyboard_configs';

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

/**
 * 打开数据库连接
 */
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
            
            // 创建对象存储
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                objectStore.createIndex('name', 'name', { unique: false });
                objectStore.createIndex('date', 'date', { unique: false });
                console.log('[IndexedDB] 对象存储创建成功');
            }
        };
    });
}

/**
 * 保存文件到 IndexedDB
 */
export async function saveFile(file: FileItem): Promise<void> {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.put(file);

        request.onsuccess = () => {
            console.log('[IndexedDB] 文件保存成功:', file.name);
            resolve();
        };

        request.onerror = () => {
            console.error('[IndexedDB] 文件保存失败:', request.error);
            reject(request.error);
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * 获取所有文件
 */
export async function getAllFiles(): Promise<FileItem[]> {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.getAll();

        request.onsuccess = () => {
            const files = request.result || [];
            console.log('[IndexedDB] 获取所有文件:', files.length, '个');
            resolve(files);
        };

        request.onerror = () => {
            console.error('[IndexedDB] 获取文件失败:', request.error);
            reject(request.error);
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * 根据 ID 获取文件
 */
export async function getFileById(id: string): Promise<FileItem | null> {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            console.error('[IndexedDB] 获取文件失败:', request.error);
            reject(request.error);
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * 删除文件
 */
export async function deleteFile(id: string): Promise<void> {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.delete(id);

        request.onsuccess = () => {
            console.log('[IndexedDB] 文件删除成功:', id);
            resolve();
        };

        request.onerror = () => {
            console.error('[IndexedDB] 文件删除失败:', request.error);
            reject(request.error);
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * 清空所有文件
 */
export async function clearAllFiles(): Promise<void> {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.clear();

        request.onsuccess = () => {
            console.log('[IndexedDB] 所有文件已清空');
            resolve();
        };

        request.onerror = () => {
            console.error('[IndexedDB] 清空文件失败:', request.error);
            reject(request.error);
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * 根据 VID 和 PID 查找配置
 */
export async function getDefinitionByVidPid(vendorId: number, productId: number): Promise<KeyboardDefinition | null> {
    const files = await getAllFiles();
    
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

/**
 * 保存键盘定义
 */
export async function saveDefinition(definition: KeyboardDefinition): Promise<void> {
    const files = await getAllFiles();
    
    // 检查是否已存在相同 VID/PID 的配置
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
        } catch (error) {
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
        content: content,
    };
    
    await saveFile(fileItem);
    
    if (existingFile) {
        console.log('[IndexedDB] 更新现有配置:', definition.name);
    } else {
        console.log('[IndexedDB] 添加新配置:', definition.name);
    }
}

