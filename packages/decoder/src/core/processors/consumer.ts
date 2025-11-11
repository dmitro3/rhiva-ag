export abstract class Consumer<T extends (...args: any) => any> {
  private readonly consumers: T[];

  constructor() {
    this.consumers = [];
  }

  readonly addConsumer = <
    Fn extends T,
    U extends Consumer<Exclude<T, (...args: any) => any> | Fn>,
  >(
    fn: Fn,
  ) => {
    this.consumers.push(fn);
    return this as unknown as U;
  };

  async consume(...args: Parameters<T>): Promise<ReturnType<T>[]> {
    return Promise.all(
      this.consumers.map(async (consumer) => await consumer(...args)),
    );
  }
}

export type ConsumerReturnType<T> = T extends Consumer<infer U>
  ? Awaited<ReturnType<U>>[]
  : never;
