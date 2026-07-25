import { MessageType } from "@motajs/utils/advance/message";

export interface RegisterProjectRequest {
  handle: FileSystemDirectoryHandle;
}

export interface RegisterProjectResponse {
  id: number;
}

export const RegisterProjectMessage = new MessageType<RegisterProjectRequest, RegisterProjectResponse>("project.register");

export interface ForgetProjectRequest {
  id: number;
}

export const ForgetProjectMessage = new MessageType<ForgetProjectRequest, void>("project.forget");

export interface ProjectRecord {
  id: number;
  name: string;
  handle: FileSystemDirectoryHandle;
  lastTime: number;
}

export interface ProjectSummary {
  id: number;
  name: string;
  lastTime: number;
  permission: PermissionState;
  active: boolean;
  hasIndex?: boolean;
}

export type ProjectAccessResult
  = | { status: "ready"; project: ProjectSummary }
    | { status: "permission-required"; project: ProjectSummary }
    | { status: "not-found" };

export interface ProjectReferenceRequest {
  id: number;
}

export interface ProjectDetailsResponse {
  access: ProjectAccessResult;
  handle?: FileSystemDirectoryHandle;
}

export interface ListProjectsResponse {
  list: ProjectSummary[];
}

export const ListProjectMessage = new MessageType<void, ListProjectsResponse>("project.list");
export const GetProjectMessage = new MessageType<ProjectReferenceRequest, ProjectDetailsResponse>("project.get");
export const ActivateProjectMessage = new MessageType<ProjectReferenceRequest, ProjectAccessResult>("project.activate");

export type EditorHostStatus
  = | {
    status: "ready";
    buildId: string;
    editorVersion: string;
    source: "network" | "validated-cache" | "cache";
  }
  | {
    status: "unavailable";
    reason: "not-installed" | "offline" | "invalid-artifact" | "incompatible-environment";
    message: string;
  };

export interface EditorReleaseIdentity {
  buildId: string;
  version: string;
}

export interface EditorUpdateState {
  protocolVersion: 2;
  status: "ready";
  launch?: EditorReleaseIdentity;
  candidate?: EditorReleaseIdentity;
  staging?: {
    buildId: string;
    version?: string;
    completedFiles: number;
    totalFiles: number;
    completedBytes: number;
    totalBytes: number;
    error?: string;
  };
  lastCheckedAt?: number;
}

export const GetEditorHostStatusMessage = new MessageType<void, EditorHostStatus>("editor.status");
