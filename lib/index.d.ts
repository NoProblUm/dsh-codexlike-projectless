export declare const name = "dsh-projectless-session";
export declare const inject: string[];
export interface Config { root?: string; debug?: boolean }
import type { Context } from '@deepseek-ai/cordis';
export declare function apply(ctx: Context, config?: Config): void;
