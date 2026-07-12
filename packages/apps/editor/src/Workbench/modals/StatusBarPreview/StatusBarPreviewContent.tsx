import { useCallback, useEffect, useState, type FC } from "react";
import { buildRuntimePreviewContext, RuntimeSurface, useRuntimePreview, type RuntimeSurfaceLease } from "@/runtime";

interface StatusBarPreviewContentProps {
  code: string;
  orientation: "horizontal" | "vertical";
}

const extractFlags = (code: string): Record<string, number> => {
  const flags: Record<string, number> = {};
  code.replace(/flag:([a-zA-Z0-9_\u4E00-\u9FCC\u3040-\u30FF\u2160-\u216B\u0391-\u03C9]+)/g, (s0, s1) => {
    flags[s1] = 0;
    return s0;
  });
  code.replace(/(core\.)?flags.([a-zA-Z0-9_]+)/g, (s0, s1, s2) => {
    if (!s1) flags[s2] = 0;
    return s0;
  });
  code.replace(/core\.(has|get|set|add|remove)Flag\('(.*?)'/g, (s0, _s1, s2) => {
    flags[s2] = 0;
    return s0;
  });
  code.replace(/core\.(has|get|set|add|remove)Flag\("(.*?)"/g, (s0, _s1, s2) => {
    flags[s2] = 0;
    return s0;
  });
  return flags;
};

export const StatusBarPreviewContent: FC<StatusBarPreviewContentProps> = ({ code, orientation }) => {
  const runtime = useRuntimePreview();
  const [lease, setLease] = useState<RuntimeSurfaceLease | null>(null);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
  const [values, setValues] = useState({
    name: "阳光",
    hp: "1000",
    hpmax: "9999",
    atk: "10",
    def: "10",
    mdef: "0",
    mana: "0",
    manamax: "-1",
    money: "0",
    exp: "0",
    lv: "1",
    items: "yellowKey,yellowKey,blueKey",
    equips: "sword1,sheild1",
    flags: "{}",
  });

  useEffect(() => {
    if (!/^function(?:\s+[$\w]+)?\s*\(/.test(code)) return;
    setValues((prev) => ({
      ...prev,
      flags: JSON.stringify(extractFlags(code)),
    }));
  }, [code]);

  const preview = useCallback(async () => {
    if (runtime.state.status !== "ready") return;
    setRuntimeError(null);
    try {
      const context = await buildRuntimePreviewContext();
      const nextLease = await runtime.previewStatusBar({ code, orientation, values, context });
      setLease(nextLease);
    } catch (error) {
      setLease(null);
      setRuntimeError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [code, orientation, runtime, values]);

  useEffect(() => {
    void preview();
    return () => lease?.close();
  }, [preview]);

  useEffect(() => {
    if (runtime.state.status !== "error" || !lease) return;
    lease.close();
    setLease(null);
  }, [lease, runtime.state.status]);

  return (
    <div id="uieventExtraBody" style={{ display: "block", marginTop: "-10px" }}>
      <p style={{ marginLeft: 10, marginRight: 10 }}>
        <b>注：此处预览效果与实际游戏内效果会有所出入，仅供参考，请以游戏内实际效果为准。</b>
      </p>
      <p id="_previewStatusBarP" style={{ display: "flex", flexWrap: orientation === "vertical" ? "wrap" : "nowrap" }}>
        <span>
          {lease ? <RuntimeSurface lease={lease} testId="runtime-status-bar-preview" /> : null}
          {!lease && runtime.state.status !== "error" && !runtimeError ? (
            <span data-test-id="runtime-status-bar-loading" style={{ display: "block", width: 128, height: 416 }} />
          ) : null}
          {!lease && (runtime.state.status === "error" || runtimeError) ? (
            <span data-test-id="runtime-status-bar-error" style={{ display: "block", width: 240 }}>
              Runtime 不可用，无法预览状态栏。
              <span data-test-id="runtime-status-bar-error-message">{runtimeError?.message ?? runtime.state.error?.message}</span>
              <button data-test-id="runtime-retry" onClick={() => void runtime.retry()}>重试</button>
            </span>
          ) : null}
        </span>
        <span style={{ margin: 10 }} id="_previewStatusBarValue">
          属性设置: <button onClick={() => void preview()}>确定</button>
          <br />
          名称:
          <input style={{ width: 50 }} value={values.name} onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))} />
          生命:
          <input style={{ width: 50 }} value={values.hp} onChange={(event) => setValues((prev) => ({ ...prev, hp: event.target.value }))} />
          上限:
          <input style={{ width: 50 }} value={values.hpmax} onChange={(event) => setValues((prev) => ({ ...prev, hpmax: event.target.value }))} />
          攻击:
          <input style={{ width: 50 }} value={values.atk} onChange={(event) => setValues((prev) => ({ ...prev, atk: event.target.value }))} />
          防御:
          <input style={{ width: 50 }} value={values.def} onChange={(event) => setValues((prev) => ({ ...prev, def: event.target.value }))} />
          护盾:
          <input style={{ width: 50 }} value={values.mdef} onChange={(event) => setValues((prev) => ({ ...prev, mdef: event.target.value }))} />
          魔力:
          <input style={{ width: 50 }} value={values.mana} onChange={(event) => setValues((prev) => ({ ...prev, mana: event.target.value }))} />
          上限:
          <input style={{ width: 50 }} value={values.manamax} onChange={(event) => setValues((prev) => ({ ...prev, manamax: event.target.value }))} />
          金币:
          <input style={{ width: 50 }} value={values.money} onChange={(event) => setValues((prev) => ({ ...prev, money: event.target.value }))} />
          经验:
          <input style={{ width: 50 }} value={values.exp} onChange={(event) => setValues((prev) => ({ ...prev, exp: event.target.value }))} />
          等级:
          <input style={{ width: 50 }} value={values.lv} onChange={(event) => setValues((prev) => ({ ...prev, lv: event.target.value }))} />
          <br />
          当前道具ID（以逗号分隔）：
          <br />
          <textarea
            style={{ width: 300, height: 40 }}
            value={values.items}
            onChange={(event) => setValues((prev) => ({ ...prev, items: event.target.value }))}
          />
          <br />
          当前装备ID（以逗号分隔）：
          <br />
          <textarea
            style={{ width: 300, height: 40 }}
            value={values.equips}
            onChange={(event) => setValues((prev) => ({ ...prev, equips: event.target.value }))}
          />
          <br />
          当前变量值（JSON格式）：
          <br />
          <textarea
            style={{ width: 300, height: 80 }}
            value={values.flags}
            onChange={(event) => setValues((prev) => ({ ...prev, flags: event.target.value }))}
          />
        </span>
      </p>
    </div>
  );
};
