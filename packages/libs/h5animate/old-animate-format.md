# 旧动画格式

2.x 原先有一种动画格式，描述如下

```ts
// .animate 文件的根结构
interface AnimateFile {
  /** 缩放比例 */
  ratio: number;
  
  /** 音效配置 - 可以是字符串或帧号到音效名的映射 */
  se?: string | { [frameNumber: number]: string };
  
  /** 音调配置 - 帧号到音调值的映射 */
  pitch?: { [frameNumber: number]: number };
  
  /** 图片数据数组 - Base64编码的图片或空字符串 */
  bitmaps: string[];
  
  /** 总帧数 */
  frame_max: number;
  
  /** 帧数据数组 - 每帧包含多个图层信息 */
  frames: FrameLayer[][];
}

// 每个图层的数据结构（原始格式为数组）
type FrameLayer = [
  number,  // [0] index: 图片索引（对应bitmaps数组的索引）
  number,  // [1] x: X轴偏移
  number,  // [2] y: Y轴偏移  
  number,  // [3] zoom: 缩放百分比
  number,  // [4] opacity: 透明度 (0-255)
  number?, // [5] mirror: 镜像标志 (0或1，可选)
  number?  // [6] angle: 旋转角度 (可选)
];
```
