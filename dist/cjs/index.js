"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectLivereload = void 0;
function connectLivereload(opt) {
    var _a, _b, _c, _d, _e;
    opt = opt !== null && opt !== void 0 ? opt : {};
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
    const handleSrc = (_a = opt.handleSrc) !== null && _a !== void 0 ? _a : ((protocol, host, port) => `${protocol}://${host}:${port}/livereload.js?snipver=1`);
    const handeScript = (_b = opt.handeScript) !== null && _b !== void 0 ? _b : ((src) => `<script src="${src}" async="" defer=""></script>`);
    const getProtocol = (req) => { var _a; return (_a = opt === null || opt === void 0 ? void 0 : opt.protocol) !== null && _a !== void 0 ? _a : req.protocol; };
    const include = opt.include || [/.*/];
    const isHtmlText = (_c = opt.html) !== null && _c !== void 0 ? _c : ((str) => (str ? /<[:_-\w\s\!\/\=\"\']+>/i.test(str) : false));
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
    const port = (_d = opt.port) !== null && _d !== void 0 ? _d : 35729;
    const plugins = (_e = opt.plugins) !== null && _e !== void 0 ? _e : [];
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
    // 返回中间件
    return function livereload(req, res, next) {
        var _a;
        // 每次请求都要注入js
        if (res._ishook)
            return next();
        res._ishook = true;
        const host = (_a = opt === null || opt === void 0 ? void 0 : opt.hostname) !== null && _a !== void 0 ? _a : req.hostname;
        const protocol = getProtocol(req);
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
            var _a;
            push.prototype.data = ((_a = push.prototype.data) !== null && _a !== void 0 ? _a : "") + chunk;
        }
        res.write = (chunk, encoding) => {
            if (!needInject)
                return res_write(chunk, encoding);
            if (chunk) {
                const _chunk = chunk instanceof Buffer ? chunk.toString(encoding) : chunk;
                // 为此块注入 livereload.js
                if (!hasIncludesLivereloadJS(push.prototype.data)) {
                    push(injectLivereloadJS(_chunk, protocol, host));
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
                push.prototype.data = injectLivereloadJS(htmlData, protocol, host);
            }
            if (push.prototype.data !== undefined) {
                res.setHeader("content-length", Buffer.byteLength(push.prototype.data, encoding));
            }
            res_end(push.prototype.data, encoding);
        };
        next();
    };
}
exports.connectLivereload = connectLivereload;
