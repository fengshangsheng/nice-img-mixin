`npm install nice-img-mixin`

```javascript
// webpack.config.js
const MixinImg = require('nice-img-mixin');

module.exports = {
  // some code......
  plugins: [
    // some code......
    new MixinImg({
      // 必填：需要生成精灵图的目录文件夹路径
      resolveDir: {
        textzz: './src/images/test',
        modalzz: './src/images/modal'
      },
      // 必填：精灵图输出的路径
      outDir: './src/images',
      // 选填：是否需要生成.ts图片名称声明
      tsStatement: true
    })
    // some code......
  ]
  // some code......
}
```
