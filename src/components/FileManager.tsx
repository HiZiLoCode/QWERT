import React, { useState, useEffect } from 'react';
import {
    Box,
    Drawer,
    Typography,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Button,
    Stack,
} from '@mui/material';
import {
    Close as CloseIcon,
    InsertDriveFile as FileIcon,
    CloudUpload as UploadIcon,
    CloudDownload as DownloadIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { ButtonRem } from '@/styled/ReconstructionRem';
import * as IndexedDBStorage from '@/utils/indexeddb-storage';

interface FileItem {
    id: string;
    name: string;
    type: 'file';
    size?: number;
    date?: string;
    content?: string; // 存储文件内容
}

interface FileManagerProps {
    open: boolean;
    onClose: () => void;
    t: (key: string) => string;
}

export const FileManager: React.FC<FileManagerProps> = ({ open, onClose, t }) => {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);

    // 从 IndexedDB 加载文件
    const loadFilesFromStorage = async (): Promise<FileItem[]> => {
        try {
            const loadedFiles = await IndexedDBStorage.getAllFiles();
            console.log('[FileManager] 从 IndexedDB 加载文件:', loadedFiles.length, '个');
            return loadedFiles;
        } catch (error) {
            console.error('[FileManager] 加载文件失败:', error);
            return [];
        }
    };

    // 当 FileManager 打开时，重新加载文件列表
    useEffect(() => {
        if (open) {
            console.log('[FileManager] 打开，重新加载文件列表');
            setLoading(true);
            loadFilesFromStorage().then(loadedFiles => {
                setFiles(loadedFiles);
                setLoading(false);
            });
        }
    }, [open]);

    const handleUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json'; // 只接受 JSON 文件
        input.multiple = true;
        input.onchange = async (e: any) => {
            const uploadedFiles = Array.from(e.target.files || []) as File[];

            // 过滤只保留 JSON 文件
            const jsonFiles = uploadedFiles.filter(file =>
                file.name.toLowerCase().endsWith('.json') ||
                file.type === 'application/json'
            );

            if (jsonFiles.length === 0) {
                alert('请选择 JSON 文件！');
                return;
            }

            setLoading(true);

            // 读取文件内容并保存到 IndexedDB
            for (const file of jsonFiles) {
                try {
                    const content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                        reader.onload = (event) => resolve(event.target?.result as string);
                        reader.onerror = reject;
                        reader.readAsText(file);
                    });

                    const newFile: FileItem = {
                        id: `${Date.now()}-${Math.random()}`,
                        name: file.name,
                        type: 'file',
                        size: file.size,
                        date: new Date().toISOString(),
                        content: content,
                    };

                    await IndexedDBStorage.saveFile(newFile);
                    console.log('[FileManager] 文件已保存到 IndexedDB:', newFile.name);
                } catch (error) {
                    console.error('[FileManager] 保存文件失败:', error);
                    alert(`保存文件 ${file.name} 失败`);
                }
            }

            // 重新加载文件列表
            const loadedFiles = await loadFilesFromStorage();
            setFiles(loadedFiles);
            setLoading(false);
        };
        input.click();
    };

    const handleDownload = (file: FileItem) => {
        if (!file.content) {
            alert('文件内容为空');
            return;
        }
        
        try {
            // 创建下载链接
            const blob = new Blob([file.content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            // 延迟清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log('文件已下载:', file.name);
        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败，请重试');
        }
    };

    const handleExportAll = () => {
        if (files.length === 0) {
            alert('没有可导出的文件');
            return;
        }

        try {
            // 将所有文件打包成一个 JSON
            const exportData = {
                exportDate: new Date().toISOString(),
                totalFiles: files.length,
                files: files.map(f => ({
                    name: f.name,
                    content: f.content,
                    date: f.date,
                    size: f.size,
                })),
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = `keyboard_configs_${new Date().toISOString().split('T')[0]}.json`;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            // 延迟清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log('已导出文件:', fileName);
            alert(`成功导出 ${files.length} 个配置文件`);
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败，请重试');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('确定要删除这个文件吗？')) {
            try {
                await IndexedDBStorage.deleteFile(id);
                console.log('[FileManager] 文件已删除:', id);
                
                // 重新加载文件列表
                const loadedFiles = await loadFilesFromStorage();
                setFiles(loadedFiles);
            } catch (error) {
                console.error('[FileManager] 删除文件失败:', error);
                alert('删除文件失败');
            }
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString();
        } catch {
            return '-';
        }
    };

    return (
        <>
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: { xs: '100%', sm: '25rem' },
                        bgcolor: 'background.default',
                    },
                }}
            >
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Header */}
                    <Box
                        sx={{
                            p: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '0.0625rem solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.125rem', p: '0.3125rem' }}>
                            本地配置管理
                        </Typography>
                        <IconButton onClick={onClose} size="small" sx={{ p: '0.3125rem' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ p: '1.25rem',  borderBottom: '0.0625rem solid', borderColor: 'divider' }}>
                        <Stack direction="row" spacing="0.625rem">
                            <ButtonRem
                                variant="contained"
                                startIcon={<UploadIcon />}
                                onClick={handleUpload}
                                size="small"
                                fullWidth
                                sx={{
                                    fontSize: '0.875rem',
                                    "&.MuiButton-startIcon": {
                                        mr:"0.5rem"
                                    }
                                }}
                            >
                                上传
                            </ButtonRem>
                            <ButtonRem
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={handleExportAll}
                                size="small"
                                fullWidth
                                sx={{ fontSize: '0.875rem' }}
                                disabled={files.length === 0}
                            >
                                导出全部
                            </ButtonRem>
                        </Stack>
                    </Box>

                    {/* File List */}
                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                        {loading ? (
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                    p: '2rem',
                                    color: 'text.secondary',
                                }}
                            >
                                <Typography variant="body2">加载中...</Typography>
                            </Box>
                        ) : files.length === 0 ? (
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                    p: '2rem',
                                    color: 'text.secondary',
                                }}
                            >
                                <FileIcon sx={{ fontSize: '3rem', mb: '1rem', opacity: 0.3 }} />
                                <Typography variant="body2">暂无配置文件</Typography>
                                <Typography variant="caption">点击上传按钮添加文件</Typography>
                            </Box>
                        ) : (
                            <List>
                                {files.map((file) => (
                                    <ListItem
                                        key={file.id}
                                        sx={{
                                            '&:hover': {
                                                bgcolor: 'action.hover',
                                            },
                                            py: '0.75rem',
                                        }}
                                        secondaryAction={
                                            <Stack direction="row" spacing="0.3125rem">
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    onClick={() => handleDownload(file)}
                                                    sx={{ p: '0.5rem' }}
                                                >
                                                    <DownloadIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    onClick={() => handleDelete(file.id)}
                                                    sx={{ p: '0.5rem' }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        }
                                    >
                                        <ListItemIcon sx={{ minWidth: '2.5rem' }}>
                                            <FileIcon />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={file.name}
                                            secondary={`${formatFileSize(file.size)} • ${formatDate(file.date)}`}
                                            primaryTypographyProps={{
                                                sx: { fontSize: '0.875rem', fontWeight: 500 },
                                            }}
                                            secondaryTypographyProps={{
                                                sx: { fontSize: '0.75rem' },
                                            }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>

                    {/* Footer */}
                    <Box
                        sx={{
                            p: '1.25rem',
                            borderTop: "0.0625rem solid",
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            共 {files.length} 个配置文件
                        </Typography>
                    </Box>
                </Box>
            </Drawer>
        </>
    );
};
