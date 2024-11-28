import { MessageType } from "@motajs/utils/advance/message";

export interface RegisterProjectRequest {
  handle: FileSystemDirectoryHandle;
}

export interface ListProjectResponse {
  id: number;
}

export const RegisterProjectMessage = new MessageType<RegisterProjectRequest, ListProjectResponse>("project.register");

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

export interface ListProjectResponse {
  list: [ProjectRecord, boolean][];
}

export const ListProjectMessage = new MessageType<void, ListProjectResponse>("project.list");
