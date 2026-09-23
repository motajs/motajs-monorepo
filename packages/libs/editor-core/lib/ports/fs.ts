/**
 * `FsPort` —— core 依赖的文件 I/O 契约（引擎无关，D-14）。
 *
 * 这是 Phase 4 资源层真正调用的**最小诚实子集**：七个操作直接继承 `@motajs/editor` 现有
 * `FsPromiseApi`（`packages/apps/editor/src/services/fs/fs.ts`）的成员名，因此 Phase 4 的迁移是
 * 一次「改名自由」的替换。`FsPromiseApi.writeMultiFiles` 被**刻意省略**：它在应用里声明了，
 * 却没有任何生产调用点，D-14 禁止为未知消费者猜测成员。
 *
 * 两条实现契约：
 *
 * 1. **未找到即拒绝。** 读取一个不存在的文件（或目录）时，实现必须以一个 `Error` 拒绝，其 `code`
 *    为 `'file-not-found'` 或 `'ENOENT'`（或 `name`/`message` 命中 `isFileNotFoundError` 识别的形状，
 *    见 `packages/apps/editor/src/fs/errors.ts`）。至少有两个调用方依赖区分「文件缺失」与「文件损坏」，
 *    因此这条契约不可省略。注意 `project-not-found` 之类的宿主错误描述的是项目句柄/访问状态，
 *    不属于本契约的「文件缺失」。
 * 2. **路径是不透明字符串。** 实现拿到什么路径就处理什么路径；core **不做**任何路径归一化或校验——
 *    路径安全属于宿主（`packages/apps/service-worker/src/server/fsApi.ts`，ARCHITECTURE §9.1）。
 *    本端口因此不引入任何路径穿越面。
 */
export interface FsPort {
  /**
   * 以文本或 base64 读取一个文件（`FsPort.readFile`）。
   *
   * 文件缺失时按上述契约拒绝：`Error.code` 为 `'file-not-found'` 或 `'ENOENT'`（或命中
   * `isFileNotFoundError` 识别的 `name`/`message` 形状）。
   */
  readFile(path: string, encoding: 'utf-8' | 'base64'): Promise<string>;

  /**
   * 以二进制读取一个文件（`FsPort.readFileBinary`）。
   *
   * 文件缺失时按上述契约拒绝：`Error.code` 为 `'file-not-found'` 或 `'ENOENT'`（或命中
   * `isFileNotFoundError` 识别的 `name`/`message` 形状）。
   */
  readFileBinary(path: string): Promise<ArrayBuffer>;

  /** 写入一个文件（`FsPort.writeFile`）。 */
  writeFile(path: string, data: string, encoding: 'utf-8' | 'base64'): Promise<void>;

  /** 删除一个文件（`FsPort.deleteFile`）。 */
  deleteFile(path: string): Promise<void>;

  /** 列出目录内容（`FsPort.readdir`）。 */
  readdir(path: string): Promise<string[]>;

  /** 创建目录（`FsPort.mkdir`）。 */
  mkdir(path: string): Promise<void>;

  /** 移动/重命名（`FsPort.moveFile`）。 */
  moveFile(src: string, dest: string): Promise<void>;
}
