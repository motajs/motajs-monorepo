# Requirements Document

## Introduction

魔塔打包器（Mota Builder）是一个 TypeScript 实现的工具，用于将魔塔游戏项目压缩打包为可发布的格式。该工具读取魔塔游戏的压缩包，执行 JS 压缩、资源打包、tileset 优化等操作，并输出到指定目录。与原 Python 版本不同，本项目仅暴露一个纯函数式的 `build` API，不提供服务端功能。

## Glossary

- **Builder**: 核心构建模块，负责协调整个打包流程
- **Extractor**: 解压模块，负责解压输入的 ZIP 文件
- **Parser**: 解析模块，负责解析 main.js、data.js、icons.js 等配置文件
- **Minifier**: JS 压缩模块，负责压缩合并 JavaScript 文件
- **ResourcePacker**: 资源打包模块，负责将图片、音效等资源打包为 .h5data/.zip 文件
- **TilesetOptimizer**: Tileset 优化模块，负责裁剪未使用的 tileset 区域
- **SplitChunk**: 分块压缩功能，将大资源包分割为多个小文件

## Requirements

### Requirement 1: 解压输入文件

**User Story:** As a developer, I want to extract a mota game zip file, so that I can process its contents for building.

#### Acceptance Criteria

1. WHEN a valid ZIP file path is provided, THE Extractor SHALL extract all contents to a temporary directory
2. WHEN the ZIP file contains GBK encoded filenames, THE Extractor SHALL correctly decode them to UTF-8
3. WHEN the ZIP file does not exist, THE Extractor SHALL return a descriptive error message
4. WHEN the ZIP file is corrupted or invalid, THE Extractor SHALL return a descriptive error message
5. WHEN the extracted content has nested directory structure, THE Extractor SHALL locate the root game directory containing main.js

### Requirement 2: 解析游戏配置

**User Story:** As a developer, I want to parse game configuration files, so that I can understand the game structure for building.

#### Acceptance Criteria

1. WHEN main.js is provided, THE Parser SHALL extract loadList, pureData, materials, enableSplitChunks, and skipResourcePackage configurations
2. WHEN data.js is provided, THE Parser SHALL extract floorIds, images, tilesets, animates, sounds, bgms, and game name
3. WHEN icons.js is provided, THE Parser SHALL extract autotile mappings
4. WHEN a configuration file is missing required fields, THE Parser SHALL return a descriptive error message
5. WHEN a configuration file has invalid JSON structure, THE Parser SHALL return a descriptive error message

### Requirement 3: 压缩 JavaScript 文件

**User Story:** As a developer, I want to minify and bundle JavaScript files, so that the game loads faster.

#### Acceptance Criteria

1. WHEN loadList is provided, THE Minifier SHALL combine all libs/*.js files into libs/libs.min.js
2. WHEN pureData is provided, THE Minifier SHALL combine all project/*.js files into project/project.min.js
3. WHEN floorIds is provided, THE Minifier SHALL combine all project/floors/*.js files into project/floors.min.js
4. THE Minifier SHALL append "main.useCompress = true;" to main.js after compression
5. THE Minifier SHALL append a random version number to main.js for cache busting
6. IF minification fails for a file, THEN THE Minifier SHALL return a descriptive error with the filename

### Requirement 4: 打包资源文件

**User Story:** As a developer, I want to package game resources into compressed archives, so that the game can load them efficiently.

#### Acceptance Criteria

1. WHEN images list is provided, THE ResourcePacker SHALL create project/images/images.h5data containing all image files
2. WHEN materials list is provided, THE ResourcePacker SHALL create project/materials/materials.h5data containing all material PNG files
3. WHEN tilesets list is provided, THE ResourcePacker SHALL create project/tilesets/tilesets.h5data containing all tileset files
4. WHEN autotiles list is provided, THE ResourcePacker SHALL create project/autotiles/autotiles.h5data containing all autotile PNG files
5. WHEN animates list is provided, THE ResourcePacker SHALL create project/animates/animates.h5data containing all .animate files
6. WHEN sounds list is provided, THE ResourcePacker SHALL create project/sounds/sounds.h5data containing all sound files
7. WHEN libs.min.js contains "images.zip", THE ResourcePacker SHALL use .zip extension instead of .h5data
8. WHEN skipResourcePackage is true, THE ResourcePacker SHALL skip resource packaging

### Requirement 5: 分块压缩

**User Story:** As a developer, I want to split large resource packages into smaller chunks, so that the game can load progressively.

#### Acceptance Criteria

1. WHEN enableSplitChunks is true, THE ResourcePacker SHALL split packages exceeding 2MB threshold
2. WHEN a package is split, THE ResourcePacker SHALL name chunks as {type}-0.h5data, {type}-1.h5data, etc.
3. WHEN packages are split, THE Builder SHALL write splitChunkMap configuration to main.js
4. WHEN enableSplitChunks is false, THE ResourcePacker SHALL create single package files
5. IF a single resource file exceeds 5MB without split chunks enabled, THEN THE ResourcePacker SHALL return a warning

### Requirement 6: Tileset 优化

**User Story:** As a developer, I want to optimize tileset images, so that unused tiles are removed to reduce file size.

#### Acceptance Criteria

1. WHEN floors.min.js is available, THE TilesetOptimizer SHALL extract all 5+ digit numbers as tileset IDs
2. THE TilesetOptimizer SHALL identify which tiles are actually used based on extracted IDs
3. THE TilesetOptimizer SHALL crop tileset images to remove unused tile regions
4. WHEN a tileset has no used tiles, THE TilesetOptimizer SHALL replace it with a minimal 32x32 transparent image
5. THE TilesetOptimizer SHALL preserve the original tileset numbering scheme (starting from 10000 per tileset)

### Requirement 7: 图片压缩

**User Story:** As a developer, I want to compress large images, so that the game package size is reduced.

#### Acceptance Criteria

1. WHEN a PNG image exceeds 256KB, THE ResourcePacker SHALL convert it to palette mode (P) for compression
2. WHEN a JPG image exceeds 256KB, THE ResourcePacker SHALL re-save it with quality=30
3. THE ResourcePacker SHALL preserve original image if compression fails
4. THE ResourcePacker SHALL log compression results showing before and after sizes

### Requirement 8: 构建输出

**User Story:** As a developer, I want to output the built game to a specified directory, so that I can deploy or distribute it.

#### Acceptance Criteria

1. WHEN build completes successfully, THE Builder SHALL copy all processed files to the output directory
2. WHEN build completes successfully, THE Builder SHALL return a BuildResult with success=true and outputDir
3. WHEN build fails, THE Builder SHALL return a BuildResult with success=false and error message
4. THE Builder SHALL clean up temporary files after build completes
5. THE Builder SHALL provide progress logging through the logger callback

### Requirement 9: 错误处理

**User Story:** As a developer, I want clear error messages, so that I can diagnose and fix build issues.

#### Acceptance Criteria

1. WHEN an error occurs, THE Builder SHALL provide error messages in Chinese
2. WHEN an error occurs, THE Builder SHALL include the specific file or operation that failed
3. THE Builder SHALL NOT silently swallow errors
4. WHEN multiple errors occur, THE Builder SHALL report all errors before stopping
