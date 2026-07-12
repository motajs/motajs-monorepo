export const tapAsync = <T>(promise: Promise<T>, action: () => void) => {
    action();
    return promise;
}
