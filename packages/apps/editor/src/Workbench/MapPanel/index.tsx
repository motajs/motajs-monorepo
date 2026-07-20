import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FC,
} from "react";
import { Button, Dropdown, Input, Modal, Tabs, type MenuProps } from "antd";
import {
  AlertTriangle,
  Copy,
  FilePlus2,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";

import { floorCommands, mapCommands } from "@/project/commands";
import { formatMapMatrixText, parseMapMatrixText } from "@/project/commands/mapMatrix";
import { projectData } from "@/project/data/projectData";
import {
  buildFloorOrganizationTokens,
  floorMatchesQuery,
  organizationFromTokens,
  partitionContainingFloor,
  validateFloorOrganization,
  type FloorOrganizationToken,
  type FloorPartition,
} from "@/project/model/floorOrganization";
import { projectModel, type FloorListItem } from "@/project/model/projectModel";
import {
  useModelResourceSuspense,
  useTowerDataSuspense,
} from "@/hooks/suspense";
import { useCurrentFloorId } from "@/stores/editorState";
import { PanelStore } from "@/stores/PanelStore";
import { useFloorNavigation } from "@/MapEditor/useFloorNavigation";
import { notifyCommandResult, notifyError, notifySuccess } from "@/utils/notify";
import { isValidFloorId } from "@/utils/string";
import { BatchCreateMapsForm } from "./BatchCreateMapsForm";
import "./map-panel.css";

type CopyRequest = { sourceFloorId: string; mode: "full" | "blank" };
type MapDataDialog = { floorId: string; mode: "import" | "export" };

function parseDimension(value: string): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 128 ? number : undefined;
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function nextCopyId(sourceFloorId: string, floorIds: readonly string[]): string {
  const existing = new Set(floorIds.map((floorId) => floorId.toLocaleLowerCase()));
  let suffix = "_copy";
  let index = 2;
  while (existing.has(`${sourceFloorId}${suffix}`.toLocaleLowerCase())) suffix = `_copy${index++}`;
  return `${sourceFloorId}${suffix}`;
}

export const MapPanel: FC = () => {
  const [tower] = useTowerDataSuspense();
  const currentFloorId = useCurrentFloorId();
  const floorId = currentFloorId ?? tower.firstData?.floorId ?? tower.main.floorIds[0] ?? "";
  const navigateFloor = useFloorNavigation(floorId);
  const { setActiveMapPanel } = PanelStore.useStore();
  const floorListResource = useMemo(() => projectModel.floorList(), []);
  const floorList = useModelResourceSuspense(floorListResource);
  const blockRegistryResource = useMemo(() => projectModel.blockRegistry(), []);
  const blockRegistry = useModelResourceSuspense(blockRegistryResource);
  const rawPartitions = tower.main.floorPartitions;
  const organization = useMemo(
    () => validateFloorOrganization(tower.main.floorIds, rawPartitions),
    [rawPartitions, tower.main.floorIds],
  );
  const tokens = useMemo(
    () => organization.valid
      ? buildFloorOrganizationTokens(tower.main.floorIds, organization.partitions)
      : tower.main.floorIds.map((one): FloorOrganizationToken => ({ kind: "floor", floorId: one })),
    [organization.partitions, organization.valid, tower.main.floorIds],
  );
  const floorById = useMemo(() => new Map(floorList.map((floor) => [floor.id, floor])), [floorList]);

  const [filter, setFilter] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState("single");
  const [newFloorId, setNewFloorId] = useState("");
  const [newFloorTitle, setNewFloorTitle] = useState("");
  const [newFloorName, setNewFloorName] = useState("");
  const [newWidth, setNewWidth] = useState("13");
  const [newHeight, setNewHeight] = useState("13");
  const [copyRequest, setCopyRequest] = useState<CopyRequest>();
  const [copyFloorId, setCopyFloorId] = useState("");
  const [dataDialog, setDataDialog] = useState<MapDataDialog>();
  const [mapText, setMapText] = useState("");
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairText, setRepairText] = useState("");
  const floorRowRefs = useRef(new Map<string, HTMLDivElement>());

  const filteredFloors = useMemo(
    () => floorList.filter((floor) => floorMatchesQuery(floor, filter)),
    [filter, floorList],
  );
  const organizationDisabled = Boolean(filter.trim()) || !organization.valid;

  useEffect(() => {
    if (filter.trim() || !floorId) return;
    const frame = requestAnimationFrame(() => {
      floorRowRefs.current.get(floorId)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [filter, floorId, floorList]);

  const commitOrganization = useCallback(async (nextTokens: FloorOrganizationToken[]) => {
    const next = organizationFromTokens(nextTokens);
    if (next.diagnostics.length) {
      notifyError(next.diagnostics.join("；"));
      return;
    }
    const result = await floorCommands.updateOrganization(next);
    notifyCommandResult(result, "楼层顺序与分区已更新");
  }, []);

  const dropToken = useCallback((targetIndex: number, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (draggingIndex == null || organizationDisabled || draggingIndex === targetIndex) return;
    const next = [...tokens];
    const [dragged] = next.splice(draggingIndex, 1);
    next.splice(targetIndex, 0, dragged);
    setDraggingIndex(undefined);
    void commitOrganization(next);
  }, [commitOrganization, draggingIndex, organizationDisabled, tokens]);

  const createPartition = useCallback(async (targetFloorId: string) => {
    if (!organization.valid || partitionContainingFloor(tower.main.floorIds, organization.partitions, targetFloorId) != null) return;
    const partitions = [...organization.partitions, [targetFloorId, targetFloorId] as FloorPartition]
      .sort(([left], [right]) => tower.main.floorIds.indexOf(left) - tower.main.floorIds.indexOf(right));
    const result = await floorCommands.updateOrganization({ floorIds: [...tower.main.floorIds], floorPartitions: partitions });
    notifyCommandResult(result, `已为 ${targetFloorId} 创建分区`);
  }, [organization.partitions, organization.valid, tower.main.floorIds]);

  const removePartition = useCallback((partitionIndex: number) => {
    Modal.confirm({
      title: `删除分区 ${partitionIndex + 1}？`,
      content: "楼层不会被删除，只会移除这组分区边界。",
      okText: "删除分区",
      cancelText: "取消",
      onOk: async () => {
        const partitions = organization.partitions.filter((_partition, index) => index !== partitionIndex);
        const result = await floorCommands.updateOrganization({ floorIds: [...tower.main.floorIds], floorPartitions: partitions });
        notifyCommandResult(result, "分区已删除");
      },
    });
  }, [organization.partitions, tower.main.floorIds]);

  const openMapData = useCallback((targetFloorId: string, mode: MapDataDialog["mode"]) => {
    try {
      const floor = projectData.floor(targetFloorId).value();
      setMapText(formatMapMatrixText(floor.map ?? []));
      setDataDialog({ floorId: targetFloorId, mode });
    } catch (error) {
      notifyError(error);
    }
  }, []);

  const applyMapImport = useCallback(async () => {
    if (!dataDialog || dataDialog.mode !== "import") return;
    try {
      const floor = projectData.floor(dataDialog.floorId).value();
      const width = floor.width ?? floor.map?.[0]?.length ?? 13;
      const height = floor.height ?? floor.map?.length ?? 13;
      const matrix = parseMapMatrixText(mapText, { width, height });
      for (const row of matrix) {
        for (const idnum of row) {
          if (!blockRegistry.has(idnum)) throw new Error(`存在未定义图块 ID：${idnum}`);
        }
      }
      const result = await mapCommands.replaceLayer(dataDialog.floorId, "map", matrix);
      if (notifyCommandResult(result, "地图导入成功")) setDataDialog(undefined);
    } catch (error) {
      notifyError(error instanceof Error ? `格式错误：${error.message}` : error);
    }
  }, [blockRegistry, dataDialog, mapText]);

  const clearFloor = useCallback((targetFloorId: string) => {
    Modal.confirm({
      title: `清空地图 ${targetFloorId}？`,
      content: "三层图块、点位事件以及到达事件会被清空；该操作可通过历史记录撤销。",
      okButtonProps: { danger: true },
      okText: "清空地图",
      cancelText: "取消",
      onOk: async () => {
        const result = await mapCommands.clearFloorMap(targetFloorId);
        notifyCommandResult(result, "地图已清空");
      },
    });
  }, []);

  const rebuildMissingFloor = useCallback((targetFloorId: string) => {
    Modal.confirm({
      title: `重建空白楼层 ${targetFloorId}？`,
      content: "将创建一个 13 × 13 的空白楼层文件；已丢失的原地图内容无法从编辑器恢复。该操作可撤销。",
      okText: "重建空白楼层",
      cancelText: "取消",
      onOk: async () => {
        const result = await floorCommands.rebuildMissing(targetFloorId);
        notifyCommandResult(result, "空白楼层已重建");
      },
    });
  }, []);

  const deleteFloor = useCallback((targetFloorId: string, exists: boolean) => {
    Modal.confirm({
      title: exists ? `删除楼层 ${targetFloorId}？` : `移除失效楼层 ${targetFloorId}？`,
      content: exists
        ? "楼层文件和列表项都会删除；该操作可通过历史记录撤销。"
        : "楼层文件已经不存在；这里只会从楼层列表和分区中移除失效引用。该操作可撤销。",
      okButtonProps: { danger: true },
      okText: exists ? "删除楼层" : "移除失效引用",
      cancelText: "取消",
      onOk: async () => {
        const result = await floorCommands.delete(targetFloorId);
        notifyCommandResult(result, exists ? "楼层已删除" : "失效楼层引用已移除");
      },
    });
  }, []);

  const floorMenu = useCallback((targetFloorId: string, exists: boolean): MenuProps => {
    const partition = partitionContainingFloor(tower.main.floorIds, organization.partitions, targetFloorId);
    return {
      items: [
        { key: "properties", label: "编辑楼层属性", disabled: !exists },
        { key: "partition", label: "创建分区", disabled: organizationDisabled || partition != null },
        { type: "divider" },
        { key: "copy", label: <span data-test-id={`floor-copy-${targetFloorId}`}>复制地图…</span>, icon: <Copy size={14} />, disabled: !exists || !organization.valid },
        { key: "copy-blank", label: <span data-test-id={`floor-copy-blank-${targetFloorId}`}>复制空白地图…</span>, icon: <FilePlus2 size={14} />, disabled: !exists || !organization.valid },
        { type: "divider" },
        { key: "import", label: <span data-test-id="map-import-open">导入地图数据…</span>, disabled: !exists },
        { key: "export", label: "导出地图数据…", disabled: !exists },
        { key: "clear", label: <span data-test-id="map-clear-submit">清空地图…</span>, danger: true, disabled: !exists },
        { type: "divider" },
        ...(!exists
          ? [{
              key: "rebuild",
              label: <span data-test-id={`map-rebuild-${targetFloorId}`}>重建为空白楼层…</span>,
              icon: <FilePlus2 size={14} />,
            } as const]
          : []),
        {
          key: "delete",
          label: <span data-test-id="map-delete-submit">{exists ? "删除楼层…" : "从楼层列表移除…"}</span>,
          danger: true,
          disabled: !organization.valid || tower.main.floorIds.length <= 1,
        },
      ],
      onClick: ({ key }) => {
        if (key === "properties") {
          navigateFloor(targetFloorId);
          setActiveMapPanel("floor");
        }
        if (key === "partition") void createPartition(targetFloorId);
        if (key === "copy" || key === "copy-blank") {
          setCopyRequest({ sourceFloorId: targetFloorId, mode: key === "copy" ? "full" : "blank" });
          setCopyFloorId(nextCopyId(targetFloorId, tower.main.floorIds));
        }
        if (key === "import" || key === "export") openMapData(targetFloorId, key);
        if (key === "clear") clearFloor(targetFloorId);
        if (key === "rebuild") rebuildMissingFloor(targetFloorId);
        if (key === "delete") deleteFloor(targetFloorId, exists);
      },
    };
  }, [clearFloor, createPartition, deleteFloor, navigateFloor, openMapData, organization.partitions, organization.valid, organizationDisabled, rebuildMissingFloor, setActiveMapPanel, tower.main.floorIds]);

  const renderFloor = (one: FloorListItem, tokenIndex?: number) => {
    const selected = one.id === floorId;
    const menu = floorMenu(one.id, one.exists);
    const row = (
      <div
        className={`floorManagementRow${selected ? " is-selected" : ""}${one.exists ? "" : " is-missing"}${tokenIndex != null && !organizationDisabled ? " is-draggable" : ""}`}
        data-test-id={`floor-management-row-${one.id}`}
        draggable={tokenIndex != null && !organizationDisabled}
        title={organizationDisabled ? "搜索或分区数据异常时不能排序" : "拖拽调整楼层顺序"}
        ref={(element) => {
          if (element) floorRowRefs.current.set(one.id, element);
          else floorRowRefs.current.delete(one.id);
        }}
        onDragStart={(event) => {
          if (tokenIndex == null || organizationDisabled) return event.preventDefault();
          event.dataTransfer.effectAllowed = "move";
          setDraggingIndex(tokenIndex);
        }}
        onDragEnd={() => setDraggingIndex(undefined)}
        onDragOver={(event) => {
          if (tokenIndex == null || organizationDisabled || draggingIndex == null) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => tokenIndex == null ? undefined : dropToken(tokenIndex, event)}
      >
        <button type="button" className="floorManagementSelect" onClick={() => one.exists && navigateFloor(one.id)}>
          <strong>{one.title || one.id}</strong>
          <span>{one.id}{one.name && one.name !== one.title ? ` · ${one.name}` : ""}</span>
        </button>
        {!one.exists ? <span className="floorManagementMissing" title="楼层文件不存在"><AlertTriangle size={14} /></span> : null}
        <Dropdown menu={menu} trigger={["click"]}>
          <button type="button" className="floorManagementMore" data-test-id={`floor-actions-${one.id}`} aria-label={`${one.id} 更多操作`} onClick={(event) => event.stopPropagation()}>
            <MoreHorizontal size={16} />
          </button>
        </Dropdown>
      </div>
    );
    return <Dropdown key={one.id} menu={menu} trigger={["contextMenu"]}>{row}</Dropdown>;
  };

  const renderToken = (token: FloorOrganizationToken, index: number) => {
    if (token.kind === "floor") return renderFloor(floorById.get(token.floorId) ?? { id: token.floorId, exists: false }, index);
    const label = `分区 ${token.partition + 1} ${token.edge === "start" ? "开始" : "结束"}`;
    return (
      <Dropdown
        key={`partition-${token.partition}-${token.edge}`}
        trigger={["contextMenu"]}
        menu={{ items: [{ key: "delete", label: "删除分区", danger: true }], onClick: () => removePartition(token.partition) }}
      >
        <div
          className={`floorPartitionBoundary is-${token.edge}`}
          data-test-id={`floor-partition-${token.partition}-${token.edge}`}
          draggable={!organizationDisabled}
          onDragStart={(event) => {
            if (organizationDisabled) return event.preventDefault();
            event.dataTransfer.effectAllowed = "move";
            setDraggingIndex(index);
          }}
          onDragEnd={() => setDraggingIndex(undefined)}
          onDragOver={(event) => {
            if (organizationDisabled || draggingIndex == null) return;
            event.preventDefault();
          }}
          onDrop={(event) => dropToken(index, event)}
        >
          <span>{label}</span>
        </div>
      </Dropdown>
    );
  };

  const submitSingleCreate = async () => {
    const id = newFloorId.trim();
    const width = parseDimension(newWidth);
    const height = parseDimension(newHeight);
    if (!id || !isValidFloorId(id)) return notifyError("楼层 ID 只能包含字母、数字和下划线，且不能以数字开头");
    if (!width || !height) return notifyError("地图宽高必须是 1 到 128 的整数");
    const result = await floorCommands.create(id, {
      title: newFloorTitle.trim() || id,
      name: newFloorName.trim() || id,
      width,
      height,
    });
    if (notifyCommandResult(result, "楼层已创建")) {
      setCreateOpen(false);
      setFilter("");
    }
  };

  const submitCopy = async () => {
    if (!copyRequest) return;
    const target = copyFloorId.trim();
    if (!target || !isValidFloorId(target)) return notifyError("楼层 ID 不合法");
    const result = await floorCommands.copy(copyRequest.sourceFloorId, target, copyRequest.mode);
    if (notifyCommandResult(result, copyRequest.mode === "blank" ? "空白地图已复制" : "地图已复制")) {
      setCopyRequest(undefined);
      setFilter("");
    }
  };

  const applyRepair = async () => {
    try {
      const parsed = JSON.parse(repairText);
      const validation = validateFloorOrganization(tower.main.floorIds, parsed);
      if (!validation.valid) throw new Error(validation.diagnostics.join("；"));
      const result = await floorCommands.updateOrganization({ floorIds: [...tower.main.floorIds], floorPartitions: validation.partitions });
      if (notifyCommandResult(result, "楼层分区已修复")) setRepairOpen(false);
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <div id="left" className="leftTab floorManagementPanel" data-test-id="panel-map">
      <header className="floorManagementHeader">
        <div>
          <h2>楼层列表</h2>
          <span>{tower.main.floorIds.length} 个</span>
        </div>
        <Button type="text" icon={<Plus size={16} />} data-test-id="map-create-open" onClick={() => setCreateOpen(true)}>新建</Button>
      </header>
      <Input
        allowClear
        prefix={<Search size={14} />}
        placeholder="搜索楼层 ID、标题或状态栏名称"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        data-test-id="floor-management-search"
      />
      {!organization.valid ? (
        <div className="floorOrganizationDiagnostic" data-test-id="floor-organization-diagnostic">
          <AlertTriangle size={15} />
          <div><strong>楼层分区数据异常</strong><span>{organization.diagnostics.join("；")}</span></div>
          <Button
            size="small"
            onClick={() => {
              setRepairText(JSON.stringify(rawPartitions ?? [], null, 2));
              setRepairOpen(true);
            }}
          >
            修复
          </Button>
        </div>
      ) : null}
      {filter.trim() ? <p className="floorManagementFilterHint">筛选结果仅供选择；清空搜索后可调整顺序和分区。</p> : null}
      <div className="floorManagementList" data-test-id="floor-management-list">
        {filter.trim()
          ? filteredFloors.map((floor) => renderFloor(floor))
          : tokens.map(renderToken)}
        {filter.trim() && filteredFloors.length === 0 ? <div className="floorManagementEmpty">没有匹配的楼层</div> : null}
        {!filter.trim() && draggingIndex != null ? (
          <div
            className="floorOrganizationDropEnd"
            onDragOver={(event) => {
              if (organizationDisabled) return;
              event.preventDefault();
            }}
            onDrop={(event) => dropToken(tokens.length, event)}
          >
            拖到列表末尾
          </div>
        ) : null}
      </div>

      <Modal title="新建楼层" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} width={560}>
        <Tabs
          activeKey={createTab}
          onChange={setCreateTab}
          items={[
            {
              key: "single",
              label: "单个创建",
              children: (
                <div className="mapCreateForm" data-test-id="map-create-form">
                  <label>楼层 ID<Input value={newFloorId} onChange={(event) => setNewFloorId(event.target.value)} data-test-id="map-create-id" /></label>
                  <label>楼层标题<Input value={newFloorTitle} placeholder="留空时使用 ID" onChange={(event) => setNewFloorTitle(event.target.value)} data-test-id="map-create-title" /></label>
                  <label>状态栏名称<Input value={newFloorName} placeholder="留空时使用 ID" onChange={(event) => setNewFloorName(event.target.value)} data-test-id="map-create-name" /></label>
                  <div className="mapCreateDimensions">
                    <label>宽<Input value={newWidth} onChange={(event) => setNewWidth(event.target.value)} data-test-id="map-create-width" /></label>
                    <span>×</span>
                    <label>高<Input value={newHeight} onChange={(event) => setNewHeight(event.target.value)} data-test-id="map-create-height" /></label>
                  </div>
                  <Button type="primary" onClick={() => void submitSingleCreate()} data-test-id="map-create-submit">创建楼层</Button>
                </div>
              ),
            },
            {
              key: "batch",
              label: "批量创建",
              children: (
                <BatchCreateMapsForm onSuccess={() => {
                  setCreateOpen(false);
                  setFilter("");
                }}
                />
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={copyRequest?.mode === "blank" ? "复制空白地图" : "复制地图"}
        open={Boolean(copyRequest)}
        onCancel={() => setCopyRequest(undefined)}
        onOk={() => void submitCopy()}
        okText="复制"
        cancelText="取消"
        okButtonProps={{ "data-test-id": "map-copy-submit" }}
      >
        <p>源楼层：{copyRequest?.sourceFloorId}</p>
        <label className="mapDialogField">新楼层 ID<Input autoFocus value={copyFloorId} onChange={(event) => setCopyFloorId(event.target.value)} data-test-id="map-copy-id" /></label>
      </Modal>

      <Modal
        title={`${dataDialog?.mode === "export" ? "导出" : "导入"}地图数据${dataDialog ? ` · ${dataDialog.floorId}` : ""}`}
        open={Boolean(dataDialog)}
        onCancel={() => setDataDialog(undefined)}
        footer={dataDialog?.mode === "export" ? [
          <Button key="cancel" onClick={() => setDataDialog(undefined)}>关闭</Button>,
          <Button key="copy" type="primary" onClick={() => void copyText(mapText).then(() => notifySuccess("地图数据已复制"))}>复制</Button>,
        ] : [
          <Button key="cancel" onClick={() => setDataDialog(undefined)}>取消</Button>,
          <Button key="apply" type="primary" data-test-id="map-import-submit" onClick={() => void applyMapImport()}>应用导入</Button>,
        ]}
        width={640}
      >
        <Input.TextArea
          className="mapDataTextarea"
          readOnly={dataDialog?.mode === "export"}
          value={mapText}
          onChange={(event) => setMapText(event.target.value)}
          data-test-id="map-panel-textarea"
        />
      </Modal>

      <Modal title="修复楼层分区" open={repairOpen} onCancel={() => setRepairOpen(false)} onOk={() => void applyRepair()} okText="校验并保存">
        <p>请输入由 <code>[起始楼层, 结束楼层]</code> 组成、按楼层顺序排列且互不重叠的数组。</p>
        <Input.TextArea rows={10} value={repairText} onChange={(event) => setRepairText(event.target.value)} data-test-id="floor-partition-repair-json" />
      </Modal>
    </div>
  );
};
