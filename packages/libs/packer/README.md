# @motajs/packer

魔塔游戏打包器 - 提供纯函数式的 API 来处理魔塔游戏的压缩和打包。

## 核心目标

- 暴露单一的 `build` 函数作为主入口
- 读取魔塔压缩包 → 转换处理 → 输出到指定目录
- 不提供服务端功能（与原 Python 版本不同）

## API 设计

```typescript
interface BuildOptions {
  inputPath: string;
  outputPath: string;
  logger?: (message: string) => void;
}

export function build(options: BuildOptions): Promise<void>;
```

## 魔塔项目结构

### 输入结构
```
game/
├── main.js              # 入口，包含 loadList、materials 等配置
├── libs/                # 核心库文件
├── project/
│   ├── data.js          # 游戏数据（floorIds、images、tilesets 等）
│   ├── icons.js         # 图标和 autotile 配置
│   ├── floors/          # 地图文件
│   ├── images/          # 图片资源
│   ├── tilesets/        # 瓦片图片
│   ├── autotiles/       # 自动元件
│   ├── animates/        # 动画文件
│   ├── sounds/          # 音效
│   └── bgms/            # 背景音乐
```

### 输出结构
- `libs/libs.min.js` - 合并压缩的核心库
- `project/project.min.js` - 合并压缩的数据文件
- `project/floors.min.js` - 合并压缩的地图文件
- `project/*/images.h5data` 等 - 压缩的资源包

## 开发指南

参考项目根目录的 steering 文件了解通用开发规范。