import { Alert, Button } from 'antd';
import { ReactElement } from 'react';
import { TableGrid, TablePanelStatus } from '../../shared/schemaForm/components/TableGrid';
import { ITableRowNode } from '../../shared/schemaForm/types';

// 配置模式的主区视图：顶部「← 返回素材列表」退回浏览态、有校验错误时给错误列表，
// 主体直接复用抽到 shared 的表格表单引擎（同一网格 / 控件 / 校验 / 折叠 / 成对关键字），不另写一套。

export interface IAssetConfigViewProps {
  /** 配置表单标题（通常是素材名） */
  readonly title: string;
  /** 配置表单的行树 */
  readonly rows: readonly ITableRowNode[];
  /** 配置校验的错误文案；空数组表示校验通过 */
  readonly errors: readonly string[];
  /** 是否存在尚未落盘的改动 */
  readonly unsaved: boolean;
  /**
   * 一次字段提交
   * @param path 配置字段路径
   * @param value 目标值
   */
  onChange(path: string, value: unknown): void;
  /** 保存配置改动 */
  onSave(): void;
  /** 返回素材列表 */
  onBack(): void;
}

/**
 * 每素材配置表单视图：面包屑 + 校验错误列表 + 复用的表格表单引擎
 * @param props 配置视图 props
 * @returns 配置视图元素
 */
export function AssetConfigView(props: IAssetConfigViewProps): ReactElement {
  // 没有任何字段时落回表格引擎既有的空态；否则按就绪渲染行树
  const status = props.rows.length === 0 ? TablePanelStatus.EmptySchema : TablePanelStatus.Ready;

  return (
    <div className="asset-config-view" data-test-id="asset-config-view">
      <div className="asset-config-breadcrumb">
        <Button
          type="link"
          size="small"
          autoInsertSpace={false}
          data-test-id="asset-config-back"
          onClick={props.onBack}
        >
          ← 返回素材列表
        </Button>
      </div>
      {props.errors.length === 0 ? null : (
        <div className="asset-config-errors" data-test-id="asset-config-errors">
          <Alert
            type="error"
            showIcon
            title="配置校验未通过"
            description={
              <ul className="asset-config-error-list">
                {props.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            }
          />
        </div>
      )}
      <div className="asset-config-body">
        <TableGrid
          status={status}
          rows={props.rows}
          onChange={props.onChange}
          unsaved={props.unsaved}
          onSave={props.onSave}
          title={props.title}
        />
      </div>
    </div>
  );
}
