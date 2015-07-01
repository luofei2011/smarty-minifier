#### 使用场景

压缩smarty中的css或者js、特别针对js和smarty混写的场景。写了此插件。

当然，单纯压缩html中的js和css是完全没有问题的。

#### 使用方法

    npm install uglify-js # 装js压缩器
    npm install uglifycss # css压缩器
    npm install mkdirp    # 目录创建插件

然后使用本插件。

    var minifier = require('./minifier');

    minifier.init('/path/to/test.tpl', {
        outputDir: './output/',
        exclude: ['.git', '.svn']
    });

默认会压缩目录下的所有文件中的js和css部分。不是这两个部分的内容不会做任何处理。

压缩后的文件会被放到`outputDir`下，路径结构保持不变。

#### 目前尚未解决的地方

详见代码注释
