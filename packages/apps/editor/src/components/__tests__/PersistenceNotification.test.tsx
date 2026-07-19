import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistenceMonitor } from "@/fs/PersistenceMonitor";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    notification: {
      useNotification: () => [{ open: mocks.open, destroy: mocks.destroy }, <div key="holder" />],
    },
  };
});

import { PersistenceNotification } from "../PersistenceNotification";

describe("PersistenceNotification", () => {
  beforeEach(() => {
    persistenceMonitor.resetForTests();
    mocks.open.mockReset();
    mocks.destroy.mockReset();
  });

  it("opens one permanent bottom-right aggregate and closes it after retry succeeds", async () => {
    let shouldFail = true;
    render(<PersistenceNotification />);

    await act(async () => {
      persistenceMonitor.schedule("project/data.js", {
        kind: "write",
        execute: async () => {
          if (shouldFail) throw new Error("disk unavailable");
        },
      });
      await persistenceMonitor.whenQuiescent();
    });

    await waitFor(() => expect(mocks.open).toHaveBeenCalled());
    const options = mocks.open.mock.calls.at(-1)?.[0];
    expect(options).toMatchObject({
      key: "project-persistence-failures",
      message: "工程文件写入失败（1）",
      placement: "bottomRight",
      duration: 0,
      closable: false,
    });

    render(options.description);
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "重试全部" }));

    await waitFor(() => {
      expect(persistenceMonitor.failedFiles()).toEqual([]);
      expect(mocks.destroy).toHaveBeenCalledWith("project-persistence-failures");
    });
  });
});
