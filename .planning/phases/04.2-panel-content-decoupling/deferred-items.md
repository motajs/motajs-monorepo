# 04.2 延迟项（执行期发现）

## 04.2-13（开发宿主变化流 / 资源管理器接线）

执行本计划时确认：`pnpm --filter @motajs/editor-dev test` 全量仍为 **100 passed / 5 failed**。以下 5 条在把 `MemoryBackend` 换回 HEAD 版本（不含 `watch`）后同样失败，属**本计划之前**遗留，与本计划的改动无关；按执行器「范围边界」规则未修改。

| 文件 | 用例 | 失败现象 | 初步定位 |
|------|------|----------|----------|
| `src/__tests__/devHostTable.test.tsx` | 点击「撤销」按钮还原表格的改值编辑 | 撤销后点保存，文件仍是改后的值 | 撤销会递增 `contentVersion`，`EditableTable` 的版本副作用把组件脏标记清成 `false`，`table-save` 随 `unsaved=false` 被禁用；该用例断言的是「撤销后再点保存」这条旧交互 |
| `src/__tests__/devHostMap.test.tsx` | 画格切层加层改属性保存后重开，改动与图层名都在 | 保存后的格子里是 0 | 地图面板的保存 / 基线交互在 Plan 15 之后与用例预期不一致 |
| `src/__tests__/devHostMap.test.tsx` | 未保存时关闭标签会先保存再关闭 | 关闭后标签 `typeId` 仍是 `map` | 同上工作分支的地图关闭流程 |
| `src/__tests__/devHostMap.test.tsx` | 保存失败时关闭标签被拒绝并显示错误 | 提示行为空，未出现「磁盘已满」 | 同上 |
| `src/__tests__/devHostCodeEditor.test.tsx` | 打开显示原文并可编辑回写、保存后系统前缀逐字保留 | 回写后的 JSON 仍是原文 | 代码编辑器回写路径在更早计划后与用例预期不一致 |

## 结论

- 本计划新增的 7 条用例（`devHostExplorer.test.tsx` 4 条、`devHostWatch.test.tsx` 3 条）单独运行全绿。
- `pnpm --filter @motajs/editor-impl test` 全量 1148 条通过，确认开发宿主改动没有反向影响实现包。
- 上述 5 条建议由对应计划（表格撤销、地图保存 / 关闭、代码编辑器回写）单独修复，不在 04.2-13 的文件范围内。
