export interface Notification {
    id: string;
    title: string;
    content: string;
    destId?: string;
    roomId?: string;
    timestamp?: string;
    metadata?: Record<string, any>;
}