import { Button, notification } from "antd";
import { useEffect, type FC } from "react";
import { persistenceMonitor } from "@/fs/PersistenceMonitor";
import { useSignal } from "@/hooks/useFs";

const NOTIFICATION_KEY = "project-persistence-failures";

export const PersistenceNotification: FC = () => {
  const [api, contextHolder] = notification.useNotification();
  const failures = useSignal(persistenceMonitor.failedFiles);
  const retrying = useSignal(persistenceMonitor.retrying);

  useEffect(() => {
    if (failures.length === 0) {
      api.destroy(NOTIFICATION_KEY);
      return;
    }

    api.open({
      key: NOTIFICATION_KEY,
      message: `工程文件写入失败（${failures.length}）`,
      description: (
        <div data-test-id="persistence-failure-notification">
          <div style={{ maxHeight: 220, overflow: "auto" }}>
            {failures.map(({ path, error }) => (
              <div key={path} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>{path}</div>
                <div style={{ color: "var(--ant-color-error, #ff4d4f)", overflowWrap: "anywhere" }}>
                  {error.message}
                </div>
              </div>
            ))}
          </div>
          <Button
            data-test-id="persistence-retry-all"
            loading={retrying}
            onClick={() => void persistenceMonitor.retryFailed()}
            size="small"
            type="primary"
          >
            重试全部
          </Button>
        </div>
      ),
      placement: "bottomRight",
      duration: 0,
      closable: false,
    });
  }, [api, failures, retrying]);

  return contextHolder;
};
