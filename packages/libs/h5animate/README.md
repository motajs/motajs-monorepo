# @motajs/h5animate

高压缩率 animate 格式，后缀为 `.h5animate`

## 文件结构

二进制格式，组成如下：

1. **文件头**：
   - 标识符：4 字节（`ANIM`）。
   - 版本号：UInt32
   - 图像数据大小：UInt32
   - 元信息大小：UInt32
2. **图像数据**：
   - 精灵图元信息，包括
     - 精灵图数量：UInt32
     - 每张精灵图的宽高：UInt32 + UInt32
   - 精灵图，为 WebP 格式的二进制数据，动画帧垂直排布在精灵图上。
3. **元信息**：
   - JSON 字符串，编码为二进制格式。

## 元信息字段

```ts
interface H5AnimateMeta {
  /** 全局缩放比例 */
  ratio: number;
  /** 帧信息 */
  frame: H5AnimateFrame[];
}

interface H5AnimateFrame {
  sound?: SoundMeta[];
  objects?: H5AnimateObject[];
}

interface Sound {
  name: string;
  volume?: number;
  pitch?: number;
}

interface H5AnimateObject {
  index: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  mirror?: number;
  rotate?: number;
}
```

实际编码中，H5AnimateObject 会被压缩为数组形式以节省空间

```ts
type CompressedH5AnimateObject = [
  index: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  mirror: number;
  rotate: number;
];
```
