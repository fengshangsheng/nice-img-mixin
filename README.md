`npm install nice-img-mixin`

```javascript
const MixinImg = require('nice-img-mixinWH');

new MixinImgWH({
  // 必填：需要生成精灵图的目录文件
  resolveDir: {
    textzz: './src/images/test',
    modalzz: './src/images/modal'
  },
  // 必填：精灵图输出的路径
  outMapDir: './src/images',
  // 选填：是否需要生成.ts图片文件声明
  renderTsFile: true
})
```
