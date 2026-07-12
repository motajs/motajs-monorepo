# 魔塔项目结构详解

## main.js 关键配置

从 `main.js` 中需要提取的配置：

```javascript
this.loadList = [...]      // 需要加载的核心库列表
this.pureData = [...]      // 纯数据文件列表
this.materials = [...]     // 材质图片列表
this.enableSplitChunks = true/false  // 是否启用分块压缩
this.skipResourcePackage = true/false // 是否跳过资源打包
```

## project/data.js 结构

```javascript
var data_a1e2fb4a_e986_4524_b0da_9571b5a5a2a4 = {
  main: {
    floorIds: [...],    // 地图 ID 列表
    images: [...],      // 图片列表
    tilesets: [...],    // tileset 文件列表
    animates: [...],    // 动画列表
    sounds: [...],      // 音效列表
    bgms: [...]         // BGM 列表
  },
  firstData: {
    name: "..."         // 游戏名称
  }
}
```

## project/icons.js 结构

```javascript
var icons_a1e2fb4a_e986_4524_b0da_9571b5a5a2a4 = {
  autotile: {
    "autotile1": "autotile1.png",
    ...
  }
}
```

## 资源打包格式

- `.h5data` - 默认格式，实际是 ZIP
- `.zip` - 当 libs.min.js 中包含 `images.zip` 时使用

## Tileset 优化逻辑

1. 从 floors.min.js 中提取所有 5 位以上数字（tileset ID）
2. 每个 tileset 从 10000 开始编号
3. 只保留实际使用的 tile，裁剪未使用区域
4. 重新打包为 ZIP

## 分块压缩

当 `enableSplitChunks = true` 时：
- 每个资源包限制 2MB
- 超出后分割为 `images-0.h5data`, `images-1.h5data` 等
- 在 main.js 中写入 `main.splitChunkMap` 配置