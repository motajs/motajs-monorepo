import { tryDo } from "@/exception";
import { isMatching, P } from "ts-pattern";

export class MessageType<ReqT, ResT> {
  constructor(public readonly type: string) {}
}

export interface MessageRequestOptions {
  timeout?: number;
}

export type Message = [id: number, type: string, payload: unknown];

const isMessage = isMatching([P.number, P.string, P._]);

type ConnectionHandler = PromiseWithResolvers<any>;

export class MessageClient {
  private id = 0;

  private readonly connectionHandlers: Map<number, ConnectionHandler> = new Map();

  constructor(private readonly postMessage: (msg: Message) => void) {}

  emit(message: unknown) {
    if (!isMessage(message)) {
      console.warn(`unexcpeted message format`, message);
      return;
    }
    const [requestId, _, response] = message;
    const handler = this.connectionHandlers.get(requestId);
    if (!handler) {
      console.warn(`unexcpeted message id ${requestId}`, message);
      return;
    }
    if (response instanceof Error) {
      handler.reject(response);
      return;
    }
    handler.resolve(response);
  }

  request<ResT>(type: MessageType<void, ResT>, req?: void, options?: MessageRequestOptions): Promise<ResT>;
  request<ReqT, ResT>(type: MessageType<ReqT, ResT>, req: ReqT, options?: MessageRequestOptions): Promise<ResT>;
  request<ReqT, ResT>(type: MessageType<ReqT, ResT>, req: ReqT, options?: MessageRequestOptions): Promise<ResT> {
    const handler = Promise.withResolvers<ResT>();
    const requestId = this.id++;
    this.connectionHandlers.set(requestId, handler);
    if (options?.timeout) {
      setTimeout(() => {
        handler.reject();
      }, options.timeout);
    }
    this.postMessage([requestId, type.type, req]);
    return handler.promise;
  }
}

export type MessageHandler<ReqT, ResT> = (req: ReqT) => ResT | Promise<ResT>;

export type MessageRoute<ReqT, ResT> = [MessageType<ReqT, ResT>, MessageHandler<ReqT, ResT>];

export const defineRoute = <ReqT, ResT>(type: MessageType<ReqT, ResT>, handler: (req: ReqT) => ResT | Promise<ResT>) => [type, handler] as MessageRoute<ReqT, ResT>;

export class MessageServer {
  private readonly handlerMap: Map<string, MessageHandler<unknown, unknown>>;

  constructor(routes: MessageRoute<any, any>[]) {
    this.handlerMap = new Map(routes.map(([msg, handler]) => [msg.type, handler]));
  }

  async serve(message: unknown): Promise<Message | void> {
    if (!isMessage(message)) {
      console.warn(`unexcpeted message format`, message);
      return;
    }
    const [requestId, type, req] = message;
    const handler = this.handlerMap.get(type);
    if (!handler) {
      console.warn(`unexcpeted message type ${type}`, message);
      return;
    }
    const res = await tryDo(() => handler(req), (e) => e);
    return [requestId, type, res];
  }
}
