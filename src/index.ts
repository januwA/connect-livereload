import { NextFunction } from "connect";
import express from "express";

export type FileMatcher = string | RegExp;

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

export function connectLivereload(opt: Options = {}) {
  // 不会被链接的请求
  const ignore = opt.ignore || [
    /\.js(\?.*)?$/,
    /\.css(\?.*)?$/,
    /\.svg(\?.*)?$/,
    /\.ico(\?.*)?$/,
    /\.woff(\?.*)?$/,
    /\.png(\?.*)?$/,
    /\.jpg(\?.*)?$/,
    /\.jpeg(\?.*)?$/,
    /\.gif(\?.*)?$/,
    /\.pdf(\?.*)?$/,
    /\.json(\?.*)?$/,
  ];

  const handleSrc =
    opt.handleSrc ??
    ((protocol: string, host: string, port: number) =>
      `${protocol}://${host}:${port}/livereload.js?snipver=1`);

  const handeScript =
    opt.handeScript ??
    ((src) => `<script src="${src}" async="" defer=""></script>`);

  const include = opt.include || [/.*/];

  const isHtmlText =
    opt.html ??
    ((str: string) => (str ? /<[:_-\w\s\!\/\=\"\']+>/i.test(str) : false));

  const prepend = (w: string, scripts: string) => scripts + w;
  const append = (w: string, scripts: string) => w + scripts;
  const rules = opt.rules || [
    {
      match: /<\/body>(?![\s\S]*<\/body>)/i,
      fn: prepend,
    },
    {
      match: /<\/html>(?![\s\S]*<\/html>)/i,
      fn: prepend,
    },
    {
      match: /<\!DOCTYPE.+?>/i,
      fn: append,
    },
  ];

  const port = opt.port ?? 35729;
  const plugins = opt.plugins ?? [];

  const getIjectHtmlScripts = (protocol: string, host: string) => {
    return [handleSrc(protocol, host, port)]
      .concat(plugins)
      .map(handeScript)
      .join("");
  };

  const hasIncludesLivereloadJS = (body: string) => {
    if (!body) return false;
    return body.toString().includes("/livereload.js");
  };

  function injectLivereloadJS(content: string, protocol: string, host: string) {
    let _content = content;
    const scrippts: string = getIjectHtmlScripts(protocol, host);
    const ok = rules.some((rule) => {
      // 默认首先匹配到body结束标签
      if (rule.match.test(content)) {
        _content = content.replace(rule.match, (match: string) => {
          return rule.fn(match, scrippts);
        });
        return true;
      }
      return false;
    });

    if (!ok) {
      // 没有标签的html字符串，直接将脚本加到最后
      _content = append(_content, scrippts);
    }

    return _content;
  }

  const acceptIncludesHtml = (req: any): boolean => {
    var ha: string = req.headers["accept"];
    if (!ha) return false;
    return ha.includes("html");
  };

  // 测试 str
  const isIgnore = (str: string, arr: any[]): boolean => {
    if (!str) return true;
    return arr.some((item) => {
      return (
        (item.test && item.test(str)) ||
        (typeof item === "string" && str.includes(item))
      );
    });
  };

  // 返回中间件
  return function livereload(
    req: express.Request,
    res: express.Response,
    next: NextFunction
  ) {
    // 每次请求都要注入js
    if ((res as any)._ishook) return next();
    (res as any)._ishook = true;

    const host = opt?.hostname ?? req.hostname;

    // 默认只处理html
    if (
      !acceptIncludesHtml(req) ||
      !isIgnore(req.url, include) ||
      isIgnore(req.url, ignore)
    ) {
      return next();
    }
    let needInject = true;
    const res_write = res.write.bind(res);
    const res_end = res.end.bind(res);

    function push(chunk: string) {
      push.prototype.data = (push.prototype.data ?? "") + chunk;
    }

    (res as any).write = (
      chunk: string | Buffer | undefined,
      encoding: BufferEncoding
    ) => {
      if (!needInject) return res_write(chunk, encoding);

      if (chunk) {
        const _chunk: string =
          chunk instanceof Buffer ? chunk.toString(encoding) : chunk;

        // 为此块注入 livereload.js
        if (!hasIncludesLivereloadJS(push.prototype.data)) {
          push(injectLivereloadJS(_chunk, req.protocol, host));
        } else {
          push(_chunk);
        }
      }
      return true;
    };

    (res as any).end = function (string: string, encoding: BufferEncoding) {
      if (!needInject) return res_end(string, encoding);

      // end 时也能传递数据，所以也要进行检擦
      (res as any).write(string, encoding);
      needInject = false;

      // 在对所有数据进行一次检擦
      const htmlData: string = push.prototype.data;
      if (isHtmlText(htmlData) && !hasIncludesLivereloadJS(htmlData)) {
        push.prototype.data = injectLivereloadJS(htmlData, req.protocol, host);
      }

      if (push.prototype.data !== undefined) {
        res.setHeader(
          "content-length",
          Buffer.byteLength(push.prototype.data, encoding)
        );
      }
      res_end(push.prototype.data, encoding);
    };

    next();
  };
}
