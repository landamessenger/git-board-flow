declare module "shell-quote" {
    export function parse(s: string, env?: Record<string, string>): unknown[];
    export function quote(args: string[]): string;
}
