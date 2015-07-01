/**
 * @file
 * 比较蛋疼的一个插件
 * 使用场景：smarty和js混写的文件压缩
 *           当然，完全能用于html中style和script的压缩(可以自己扩展实验部分加特殊标记的标签不压缩)
 *
 *  特别感谢：https://github.com/mishoo/UglifyJS2
 *            https://github.com/kangax/html-minifier
 *            https://github.com/fmarcia/UglifyCSS
 *
 * @author luofei(luofeihit2010@gmail.com)
 */

/** no support

// 这种双引号中又是双引号的写法不支持
var test = "{%$xxx|escape:"javascript"%}";

// 这种赋值语句中的条件判断不支持
var test = {%if $xxx%}true{%else%}false{%/if%};

 */
var fs = require('fs');
var paths = require('path');
var mkdirp = require('mkdirp');
var uglifyJS = require('uglify-js');
var uglifyCSS = require('uglifycss');


var reMinify = /<(style|script)((?:\s*[\w:\.-]+(?:\s*(?:(?:=))\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/;

// global config
var config = {
    outputDir: './output/',
    // 不需要处理的目录或者文件
    // 精确匹配，不知道模糊匹配
    exclude: ['.svn', '.git']
};

/**
 * @description 入口函数
 * 用法：init('/path/to/test.tpl', {
 *          outputDir: './output/',
 *          exclude: ['.git', '.svn', '.gitignore']
 *       });
 * @param {string} path 路径或者文件名
 * @param {Object} options 可选参数
 */
function init(path, options) {
    path = path || './';
    options = options || {};

    config.outputDir = options.outputDir || config.outputDir;
    config.exclude = options.exclude || config.exclude;

    dealFileRecursion(path);
}

/**
 * 压缩文件、并回写文件。
 * 如果压缩过程中出现问题，则直接拷贝源文件
 * @param {string} file 文件名
 */
function minify(file) {
    var outputFile = paths.join(config.outputDir, file);
    var outputDir = paths.dirname(outputFile);

    if (!fs.existsSync(outputDir)) {
        mkdirp.sync(outputDir);
    }

    fs.readFile(file, 'utf8', function (err, data) {
        if (!err && data) {
            try {
                var tmpData = removeHTMLComments(data);
                var buffer = parseSmarty(tmpData);

                fs.writeFileSync(outputFile, buffer);
                // console.log('[file] ' + file + '压缩完毕');
            }
            catch (e) {
                // 报错就直接拷贝
                fs.writeFileSync(outputFile, data);
                console.log('[file] ' + file + '压缩出错。');
            }
        }
    });
}

/**
 * 递归处理目录
 * @param {string} path 目录或者文件
 */
function dealFileRecursion(path) {
    fs.exists(path, function (e) {
        if (e) {
            var stat = fs.lstatSync(path);

            if (stat.isDirectory()) {
                fs.readdir(path, function (err, files) {
                    if (!err && files.length) {
                        if (path[path.length - 1] !== '/') {
                            path = path + '/';
                        }

                        files.forEach(function (file, index) {
                            if (config.exclude.indexOf(file) === -1) {
                                file = path + file;
                                var stat = fs.lstatSync(file);

                                if (stat.isDirectory()) {
                                    dealFileRecursion(file);
                                }
                                else {
                                    minify(file);
                                }
                            }
                        });
                    }
                });
            }
            else {
                minify(path);
            }
        }
        else {
            console.log('[warn] ' + path + '不存在');
        }
    });
}

/**
 * 移除待处理文件中的html注释
 * 这里必须移除
 * @param {string} text 待处理文本
 * @return {string} data 去掉注释后的文本
 */
function removeHTMLComments(text) {
    var start = text.indexOf('<!--');
    var end = text.indexOf('-->');
    var data = '';

    if (end >= 0) {
        data = text.substring(0, start) + text.substring(end + 3);
        text = text.substring(end + 3);
        removeHTMLComments(text);
    }
    else {
        data = text;
    }

    return data;
}

/**
 * 解析smarty或者html文件，提取style和script区域
 * @param {string} data 输入
 * @return {string} buffer
 */
function parseSmarty(data) {
    var match = data.match(reMinify);
    var endTag;
    var endTagIdx;
    var start;
    var innerContent;
    var buffer = '';

    if (match) {
        endTag = '</' + match[1] + '>';
        endTagIdx = data.indexOf(endTag);

        if (endTagIdx !== -1) {
            start = match.index + match[0].length;
            innerContent = data.substring(start, endTagIdx);

            buffer += data.substring(0, start);

            if (match[1] === 'style') {
                buffer += minifyCSS(innerContent);
            }

            if (match[1] === 'script') {
                buffer += minifyJS(innerContent);
            }

            buffer += endTag;

            data = data.substring(endTagIdx + endTag.length);

            if (data.length) {
                buffer += parseSmarty(data);
            }
        }
        else {
            buffer += data;
        }
    }
    else {
        buffer += data;
    }

    return buffer;
}

/**
 * 调用uglify-js插件压缩js字符串
 * @param {string} text 输入
 * @return {string} 压缩完毕后的js字符串
 */
function minifyJS(text) {
    // text = __smartyJS(text);
    text = __assignSmartyJS(text).replace(/({%)/g, '/**www**$1').replace(/(%})/g, '$1**www**/');
    return uglifyJS.minify(text, {
        fromString: true,
        warnings: true,
        output: {
            comments: function (node, comment) {
                var reCommentStart = /^\*www\*\*{%/;
                var reCommentEnd = /%}\*\*www\*$/;

                return reCommentStart.test(comment.value) && reCommentEnd.test(comment.value);
            }
        }
    }).code
    .replace(/"?\|\|\^_\^\|\|"?/g, '')
    .replace(/\/\*\*www\*\*{%/g, '{%')
    .replace(/%}\*\*www\*\*\/(?:\r?\n)?/g, '%}');
}

/**
 * @description 用于处理赋值语句后未添加引号的smarty语句
 * @param {string} text 输入
 * @return {string} result
 */
function __assignSmartyJS(text) {
    var reAssign = /[=:]\s*{%/;
    var result = '';
    var match = text.match(reAssign);
    var leftBrace;
    var rightBrace;

    if (match) {
        leftBrace = text.indexOf('{%', match.index);
        rightBrace = text.indexOf('%}', match.index);

        // special hack
        // 解决在字符串中出现的={%%}情况
        if (rightBrace !== -1 && /^\s*[,;\r\n]/.test(text.substring(rightBrace + 2))) {
            result += text.substring(0, leftBrace);
            // TODO 这里最好还原 -- fixed at: 2015-07-01
            result += text.substring(leftBrace, rightBrace + 2)
                      .replace(/("|')/g, '\\$1')
                      .replace(/({%)/, '"||^_^||$1')
                      .replace(/(%})/, '$1||^_^||"');

            text = text.substring(rightBrace + 2);
            result += __assignSmartyJS(text);
        }
        else {
            result += text;
            console.log('[error] 不合法的smarty赋值语句，在' + match[0]);
        }
    }
    else {
        result += text;
    }

    return result;
}

/**
 * 该函数由于不靠谱已被弃用
 * @param {string} text 输入
 * @return {string} dealData
 */
function __smartyJS(text) {
    var singleQuotes = 0;
    var doubleQuotes = 0;
    var openTagIdx;
    var closeTagIdx;
    var tmpData;
    var dealData = '';

    var matches;

    openTagIdx = text.indexOf('{%');
    tmpData = text.substring(0, openTagIdx);
    matches = tmpData.match(/'/g);
    singleQuotes = matches && matches.length || 0;

    matches = tmpData.match(/"/g);
    doubleQuotes = matches && matches.length || 0;
    if (openTagIdx !== -1) {

        // 都为偶数则证明smarty语句不在引号内
        if (!(singleQuotes % 2) && !((singleQuotes ^ doubleQuotes) % 2)) {
            closeTagIdx = text.indexOf('%}');

            // 确保是smarty的时候才替换
            if (closeTagIdx !== -1) {
                dealData += text.substring(0, closeTagIdx + 2)
                            .replace(/(\{%)/, "'_^_^_$1")
                            .replace(/(%\})/, "$1_^_^_'");

                text = text.substring(closeTagIdx + 2);
            }

            dealData += text;
            text = '';
        }
        else {
            closeTagIdx = text.indexOf('%}');

            if (closeTagIdx !== -1) {
                dealData = text.substring(0, closeTagIdx + 2);
                text = text.substring(closeTagIdx + 2);
            }
            else {
                dealData += text;
                text = '';
            }
        }
        if (text) {
            __smartyJS(text);
        }
    }
    dealData += text;

    return dealData;
}

/**
 * 调用uglifycss压缩css
 * @param {string} text 输入
 * @return {string} 压缩后的css字符串
 */
function minifyCSS(text) {
    return uglifyCSS.processString(text, {
        maxLineLen: 0,
        expandVars: 0,
        cuteComments: true
    });
}

module.exports = {
    minify: init
};
