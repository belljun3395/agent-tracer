export interface INotificationConfigReader {
    get(key: string): Promise<unknown>;
}

export interface IOsNotifier {
    notify(args: {
        readonly title: string;
        readonly message: string;
        readonly onOpen?: () => void;
    }): Promise<void>;
}
