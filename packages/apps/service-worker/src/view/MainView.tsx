import { FC } from "react";
import styles from "./MainView.module.less";
import { Button, List, Modal, Tree, Typography } from "@douyinfe/semi-ui";
import { IconFile, IconFolder } from "@douyinfe/semi-icons";
import { match } from "ts-pattern";
import { useQuery } from "react-query";
import { ForgetProjectMessage, ListProjectMessage, RegisterProjectMessage } from "@/idl";
import { TreeNodeData } from "@douyinfe/semi-ui/lib/es/tree";
import { useServiceWorker, useCurrentFn, useStatic, useServiceWorkerContainerEventAsEffect } from "@motajs/react-hooks";
import { MessageClient } from "@motajs/utils/advance/message";
import DarkModeButton from "@motajs/react-dark-mode/DarkModeButton";

const { Text } = Typography;

const isSupportLocalFS = "showDirectoryPicker" in window;

const MainView: FC = () => {
  const serviceWorker = useServiceWorker("./service-worker.js", {
    scope: window.location.pathname,
    type: "module",
  });

  const messageClient = useStatic(() => new MessageClient(async (msg) => {
    await navigator.serviceWorker.ready;
    navigator.serviceWorker.controller!.postMessage(msg);
  }));

  useServiceWorkerContainerEventAsEffect(navigator.serviceWorker, "message", (e) => {
    messageClient.emit(e.data);
  });

  const projectListQuery = useQuery(["serviceWorker.ListProjectMessage"], async () => {
    return messageClient.request(ListProjectMessage).catch(() => void 0);
  });

  const projectList = projectListQuery.data?.list ?? [];

  const openProject = (id: number) => {
    window.open(`./tower/${id}/`, "_blank");
  };

  const registerProject = useCurrentFn(async (handle: FileSystemDirectoryHandle) => {
    const { id } = await messageClient.request(RegisterProjectMessage, { handle });
    projectListQuery.refetch();
    openProject(id);
  });

  const forgetProject = useCurrentFn(async (id: number) => {
    messageClient.request(ForgetProjectMessage, { id });
    projectListQuery.refetch();
  });

  const selectLocalProject = async () => {
    try {
      const handle = await window.showDirectoryPicker({
        id: "mota-service-worker",
        mode: "readwrite",
      });
      const fileHandles = await Array.fromAsync(handle.values());
      if (!fileHandles.some((e) => e.kind === "file" && e.name === "index.html")) {
        const fileTreeData = fileHandles.map((handle): TreeNodeData => ({
          key: handle.name,
          icon: handle.kind === "file" ? <IconFile /> : <IconFolder />,
          label: handle.name,
          handle,
          isLeaf: handle.kind === "file",
        }));
        const changeOne = () => {
          modal.destroy();
          selectLocalProject();
        };
        const modal = Modal.confirm({
          content: (
            <div>
              <p>文件夹 {handle.name} 可能不是一个工程，是否选择错了？</p>
              <p>你可以<Text link onClick={changeOne}>换一个</Text>, 或者双击选择它的子文件夹</p>
              <Tree
                treeData={fileTreeData}
                onDoubleClick={(e, node) => {
                  const { handle } = node as { handle: FileSystemDirectoryHandle };
                  if (handle.kind !== "directory") return;
                  modal.destroy();
                  registerProject(handle);
                }}
              />
            </div>
          ),
          okText: "坚持打开",
          onOk: () => {
            registerProject(handle);
          },
          cancelText: "取消",
        });
        return;
      }
      registerProject(handle);
    } catch {
      //
    }
  };

  const openUnactiveProject = async (id: number, handle: FileSystemDirectoryHandle) => {
    const state = await handle.queryPermission({ mode: "readwrite" });
    if (state === "granted") {
      openProject(id);
      return;
    }
    const newState = await handle.requestPermission({ mode: "readwrite" });
    match(newState)
      .with("granted", () => {
        openProject(id);
      })
      .with("prompt", () => {
        // 什么都不做
      })
      .with("denied", () => {
        forgetProject(id);
      });
  };

  return (
    <>
      <div className={styles.topbar}>
        <DarkModeButton dropdown={{ position: "bottomRight" }} />
      </div>
      <div className={styles.title}>
        <div>
          <h1>Mota Service Worker</h1>
          <h2>在线版启动服务</h2>
        </div>
        <div>
          {isSupportLocalFS ? (
            <Button loading={!serviceWorker.isReady} onClick={selectLocalProject}>
              {serviceWorker.isReady ? "打开本地工程" : "启动服务加载中"}
            </Button>
          ) : (
            <p>你的浏览器不支持读写本地文件，请使用最新的桌面版 Chrome / Edge</p>
          )}
        </div>
      </div>
      <div className={styles.container}>
        <div className={styles.left}>
          <h3 className={styles.header}>历史记录</h3>
          <List loading={projectListQuery.isLoading}>
            {projectList.map(([{ id, name, handle }, actived]) => (
              <List.Item
                key={id}
                main={<span>{`[${id}] ${name}`}</span>}
                extra={(
                  <>
                    <Text
                      link={{ href: `./tower/${id}/`, target: "_blank" }}
                      onClick={actived ? void 0 : async (e) => {
                        e.preventDefault();
                        openUnactiveProject(id, handle);
                      }}
                    >
                      打开
                    </Text>
                    <Text />
                  </>
                )}
              />
            ))}
          </List>
        </div>
        <div className={styles.line}></div>
        <div className={styles.right}>
          <Text link={{ href: "https://jq.qq.com/?_wv=1027&k=vYiZNxL6" }}>H5魔塔交流群</Text>
          <Text link={{ href: "https://space.bilibili.com/494596570" }}>b站官方号</Text>
          <Text link={{ href: "https://h5mota.com" }}>H5mota主站</Text>
        </div>
      </div>
    </>
  );
};

export default MainView;
