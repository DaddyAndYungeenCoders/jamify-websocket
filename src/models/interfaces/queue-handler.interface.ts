export interface QueueHandler {
    queue: string;
    handler: (message: any) => Promise<void>;
}