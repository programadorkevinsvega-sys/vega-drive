import type { Dispatch, SetStateAction } from "react";
import { UploadController } from "../services/files-transfer-service";
import type { UploadItem } from "./UploadQueue";

type Controls = Map<string, UploadController>;
type UpdateItem = (id: string, changes: Partial<UploadItem>) => void;

export function pauseUpload(controls: Controls, update: UpdateItem, id: string) {
  controls.get(id)?.pause();
  update(id, { state: "paused" });
}

export function resumeUpload(controls: Controls, update: UpdateItem, id: string) {
  controls.get(id)?.resume();
  update(id, { state: "uploading" });
}

export function cancelUpload(controls: Controls, update: UpdateItem, id: string) {
  controls.get(id)?.cancel();
  update(id, { state: "cancelled", error: "" });
}

export function removePendingUpload(
  controls: Controls,
  setItems: Dispatch<SetStateAction<UploadItem[]>>,
  id: string,
) {
  controls.get(id)?.cancel();
  controls.delete(id);
  setItems((current) => current.filter((item) => item.id !== id));
}

export function cancelUploadGroup(
  controls: Controls,
  items: UploadItem[],
  update: UpdateItem,
  groupId: string,
) {
  for (const item of items) {
    if (
      item.groupId === groupId &&
      ["pending", "uploading", "paused"].includes(item.state)
    ) {
      controls.get(item.id)?.cancel();
      update(item.id, { state: "cancelled", error: "" });
    }
  }
}
