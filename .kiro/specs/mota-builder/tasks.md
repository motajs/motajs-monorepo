# Implementation Plan: Mota Builder

## Overview

基于设计文档，按模块逐步实现魔塔打包器。从基础工具函数开始，逐步构建核心模块，最后整合为完整的 build 函数。

## Tasks

- [x] 1. 项目基础设置
  - 配置 Vitest 测试框架
  - 更新 tsconfig.json 添加必要配置
  - 安装依赖：terser, sharp, jszip, iconv-lite
  - _Requirements: 项目规范_

- [x] 2. 实现 Logger 模块 (src/logger.ts)
  - [x] 2.1 实现 Logger 类
    - group/groupEnd 管理层级缩进
    - log, success, warn, error 方法
    - 支持自定义输出回调
    - _Requirements: 8.5_
  - [x] 2.2 实现日志格式化工具
    - formatSize 格式化文件大小
    - formatTimestamp 格式化时间戳
    - _Requirements: 8.5_

- [x] 3. 实现工具函数模块
  - [x] 3.1 实现 FileUtils (src/utils/file-utils.ts)
    - ensureDir, copyDir, removeDir
    - _Requirements: 8.1, 8.4_
  - [x] 3.2 实现 ZipUtils (src/utils/zip-utils.ts)
    - extractZip, createZip, decodeGbkFilename
    - _Requirements: 1.1, 1.2, 4.1-4.6_
  - [x] 3.3 实现 ImageUtils (src/utils/image-utils.ts)
    - compressImage, createTransparentImage, cropImage
    - _Requirements: 7.1, 7.2, 6.4_

- [x] 4. 实现 Extractor 模块 (src/extractor.ts)
  - [x] 4.1 实现 extract 函数
    - 解压 ZIP 到临时目录
    - 处理 GBK 编码文件名
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 4.2 实现 findRootDir 函数
    - 定位包含 main.js 的游戏根目录
    - _Requirements: 1.5_

- [x] 5. 实现 Parser 模块 (src/parser.ts)
  - [x] 5.1 实现 parseMainJs2X 函数
    - 提取 loadList, pureData, materials, enableSplitChunks, skipResourcePackage
    - _Requirements: 2.1_
  - [x] 5.2 实现 parseDataJs2X 函数
    - 提取 floorIds, images, tilesets, animates, sounds, bgms, name
    - _Requirements: 2.2_
  - [x] 5.3 实现 parseIconsJs2X 函数
    - 提取 autotile 映射
    - _Requirements: 2.3_

- [x] 6. Checkpoint - 验证解压和解析功能
  - 使用 sample/51.zip 测试解压和配置解析
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. 实现 Minifier 模块 (src/minifier.ts)
  - [x] 7.1 实现 minifyFile 函数
    - 使用 terser 压缩单个 JS 文件
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 7.2 实现 minifyMultiple 函数
    - 合并多个 JS 文件并压缩
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 7.3 实现 minifyAll 函数
    - 生成 libs.min.js, project.min.js, floors.min.js
    - 追加 useCompress 和 version 到 main.js
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8. 实现 TilesetOptimizer 模块 (src/tilesetOptimizer.ts)
  - [x] 8.1 实现 extractUsedTileIds 函数
    - 从 floors.min.js 提取 5+ 位数字
    - _Requirements: 6.1, 6.2_
  - [x] 8.2 实现 optimizeTileset 函数
    - 裁剪未使用的 tile 区域
    - 无使用时替换为 32x32 透明图
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 9. 实现 ResourcePacker 模块 (src/resourcePacker.ts)
  - [x] 9.1 实现 packResources 函数
    - 打包单个资源类型到 .h5data/.zip
    - _Requirements: 4.1-4.7_
  - [x] 9.2 实现 packWithChunks 函数
    - 分块打包超过阈值的资源
    - _Requirements: 5.1, 5.2_
  - [x] 9.3 实现 packAll 函数
    - 打包所有资源类型
    - 写入 splitChunkMap 配置
    - _Requirements: 4.1-4.8, 5.1-5.4_

- [x] 10. Checkpoint - 验证压缩和打包功能
  - 使用 sample/51.zip 测试完整压缩流程
  - 确保所有测试通过，如有问题请询问用户

- [x] 11. 实现 Builder 主模块 (src/builder.ts)
  - [x] 11.1 实现 BuildContext 创建
    - 初始化临时目录、Logger 和配置
    - _Requirements: 8.1_
  - [x] 11.2 实现完整 build 流程
    - 串联所有模块：extract → parse → minify → optimize → pack → output
    - 使用 Logger 记录各阶段进度
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  - [x] 11.3 实现清理和错误处理
    - 确保临时文件清理
    - 返回正确的 BuildResult
    - _Requirements: 8.4, 9.1, 9.2, 9.3_

- [x] 12. 实现错误处理 (src/errors.ts)
  - 定义 MotaBuilderError 类
  - 定义 ErrorCode 枚举
  - 实现中文错误消息
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 13. 更新类型定义 (src/types.ts)
  - 添加 BuildContext, FileEntry, LogLevel 等内部类型
  - 更新导出
  - _Requirements: 设计文档_

- [x] 14. Final Checkpoint - 完整集成测试
  - 使用 sample/51.zip 进行端到端测试
  - 验证输出目录结构正确
  - 验证日志输出格式正确
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 每个任务完成后运行相关测试验证
- 使用 sample/51.zip 作为真实测试数据
- 错误消息使用中文
- 遵循项目编码规范（ESM、async/await、strict 模式）
