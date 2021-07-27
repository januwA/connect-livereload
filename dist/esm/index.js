export function connectLivereload(opt = {}) {
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
    const handleSrc = opt.handleSrc ??
        ((protocol, host, port) => `${protocol}://${host}:${port}/livereload.js?snipver=1`);
    const handeScript = opt.handeScript ??
        ((src) => `<script src="${src}" async="" defer=""></script>`);
    const include = opt.include || [/.*/];
    const isHtmlText = opt.html ??
        ((str) => (str ? /<[:_-\w\s\!\/\=\"\']+>/i.test(str) : false));
    const prepend = (w, scripts) => scripts + w;
    const append = (w, scripts) => w + scripts;
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
    const getIjectHtmlScripts = (protocol, host) => {
        return [handleSrc(protocol, host, port)]
            .concat(plugins)
            .map(handeScript)
            .join("");
    };
    const hasIncludesLivereloadJS = (body) => {
        if (!body)
            return false;
        return body.toString().includes("/livereload.js");
    };
    function injectLivereloadJS(content, protocol, host) {
        let _content = content;
        const scrippts = getIjectHtmlScripts(protocol, host);
        const ok = rules.some((rule) => {
            // 默认首先匹配到body结束标签
            if (rule.match.test(content)) {
                _content = content.replace(rule.match, (match) => {
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
    const acceptIncludesHtml = (req) => {
        var ha = req.headers["accept"];
        if (!ha)
            return false;
        return ha.includes("html");
    };
    // 测试 str
    const isIgnore = (str, arr) => {
        if (!str)
            return true;
        return arr.some((item) => {
            return ((item.test && item.test(str)) ||
                (typeof item === "string" && str.includes(item)));
        });
    };
    let isBusy = false;
    // 返回中间件
    return function livereload(req, res, next) {
        if (isBusy || req.method !== "GET")
            return next();
        isBusy = true;
        const host = opt?.hostname ?? req.hostname;
        // 默认只处理html
        if (!acceptIncludesHtml(req) ||
            !isIgnore(req.url, include) ||
            isIgnore(req.url, ignore)) {
            return next();
        }
        let needInject = true;
        const res_write = res.write.bind(res);
        const res_end = res.end.bind(res);
        function push(chunk) {
            push.prototype.data = (push.prototype.data ?? "") + chunk;
        }
        res.write = (chunk, encoding) => {
            if (!needInject)
                return res_write(chunk, encoding);
            if (chunk !== undefined) {
                const _chunk = chunk instanceof Buffer ? chunk.toString(encoding) : chunk;
                // 为此块注入 livereload.js
                if (!hasIncludesLivereloadJS(push.prototype.data)) {
                    push(injectLivereloadJS(_chunk, req.protocol, host));
                }
                else {
                    push(_chunk);
                }
            }
            return true;
        };
        res.end = function (string, encoding) {
            if (!needInject)
                return res_end(string, encoding);
            // end 时也能传递数据，所以也要进行检擦
            res.write(string, encoding);
            needInject = false;
            // 在对所有数据进行一次检擦
            const htmlData = push.prototype.data;
            if (isHtmlText(htmlData) && !hasIncludesLivereloadJS(htmlData)) {
                push.prototype.data = injectLivereloadJS(htmlData, req.protocol, host);
            }
            if (push.prototype.data !== undefined) {
                res.setHeader("content-length", Buffer.byteLength(push.prototype.data, encoding));
            }
            res_end(push.prototype.data, encoding);
        };
        isBusy = false;
        next();
    };
}
