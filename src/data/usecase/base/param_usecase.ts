export interface ParamUseCase<P, T> {
    invoke(param: P): Promise<T>;
}
