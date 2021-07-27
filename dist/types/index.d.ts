import { NextFunction } from "connect";
import express from "express";
export declare type FileMatcher = string | RegExp;
export interface Rule {
    match: RegExp;
    fn: (w: string, s: string) => string;
}
export interface Options {
    /**
     * Which resource files will not be injected
     */
    ignore?: FileMatcher[];
    rules?: Rule[];
    /**
     * Which URLs will be injected
     *
     * default: all
     */
    include?: FileMatcher[];
    /**
     * Make sure `val` is html text
     */
    html?: (val: string) => boolean;
    /**
     * default: request.hostname
     */
    hostname?: string;
    /**
     *
     * livereload server port
     *
     * defautl: 35729
     */
    port?: number;
    /**
     * livereload.js script scr
     *
     */
    handleSrc?: (protocol: string, host: string, port: number) => string;
    /**
     * default: (src) => `<script src="${src}" async="" defer=""></script>`
     */
    handeScript?: (scriptsrc: string) => string;
    /**
     * What scripts do you need to inject?
     */
    plugins?: string[];
}
export declare function connectLivereload(opt?: Options): (req: express.Request, res: express.Response, next: NextFunction) => void;
//# sourceMappingURL=index.d.ts.map