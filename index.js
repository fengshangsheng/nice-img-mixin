const path = require("path");
const fs = require("fs");
const chokidar = require('chokidar');
const spritesmith = require('spritesmith');

const PluginName = 'MixinImgWH';

class MixinImgWH {
  root = ''; // 文件根目录
  resolveDir = {}; // 需要解析的入口文件
  outMapDir = ''; // 生成的文件路径
  renderTs = false;

  watcher = undefined;

  constructor({resolveDir, outMapDir, renderTs}) {
    this.resolveDir = resolveDir;
    this.outMapDir = outMapDir;
    this.renderTs = renderTs;

    if (Object.values(resolveDir).find((item) => item === outMapDir)) {
      throw new Error('resolveDir与outMapDir重合')
    }
  }

  apply(compiler) {
    this.root = compiler.options.context;

    // npm run build
    compiler.hooks.run.tapAsync(PluginName, async (compiler, cb) => {
      await this.initSpritesmith();
      cb();
    })

    // npm run start/dev
    compiler.hooks.watchRun.tapAsync(PluginName, async (compiler, cb) => {
      // 初始化时，执行一次，生成精灵图
      this.watcher === undefined && await this.initSpritesmith();
      this.initWatch();
      cb();
    })
  }

  initSpritesmith(dirNames = Object.keys(this.resolveDir)) {
    return new Promise(async (resolve, reject) => {
      const promise = []
      for (const sprite of dirNames) {
        promise.push(this.renderSpritesItem(sprite));
      }
      await Promise.all(promise);
      resolve();
    })
  }

  async initWatch() {
    // 全部需要解析的目录路径
    const dirs = Object.keys(this.resolveDir).map((key) => path.resolve(this.root, this.resolveDir[key]))
    // 取消上一次的监听
    this.watcher && await this.watcher.close();
    // 初始化监听
    this.watcher = chokidar.watch(dirs, {ignoreInitial: true});

    const _shakeEvent = this.shakeEvent();
    this.watcher.on("all", (event, filepath) => {
      for (const sprite in this.resolveDir) {
        const dir = path.resolve(this.root, this.resolveDir[sprite]);

        if (filepath.indexOf(dir) === 0) {
          // 如果是多个文件夹同时变更，就记录
          this.loadingRenderItem = [...this.loadingRenderItem || [], sprite];
          _shakeEvent(() => {
            // 根据记录变更的目录，重新生成相应的精灵图
            this.initSpritesmith([...new Set(this.loadingRenderItem)]);
          });
          break;
        }
      }
    });
  }

  renderSpritesItem(sprite) {
    return new Promise(async (resolve, reject) => {
      const dir = path.resolve(this.root, this.resolveDir[sprite]);
      const mapFilePath = this.findFiles(dir);
      const res = await this.spritesmithRun(mapFilePath);

      await this.appendFile(sprite, res);

      resolve();
    })
  }

  shakeEvent(ms = 8000) {
    let flat = false;
    let timeout = 0;

    return (event) => {
      flat && clearTimeout(timeout);
      flat = true;

      timeout = setTimeout(() => {
        flat = false;
        event();
      }, ms);
    };
  }

  findFiles(dirpath) {
    const files = fs.readdirSync(dirpath);
    let list = [];

    files.forEach((item) => {
      const filepath = path.resolve(dirpath, item);
      const stat = fs.statSync(filepath);

      if (stat.isDirectory()) {
        list = [...list, ...this.findFiles(filepath)];
      }
      if (stat.isFile()) {
        list = [...list, filepath];
      }
    });

    return list
  }

  spritesmithRun(filePaths) {
    return new Promise((resolve, reject) => {
      const res = spritesmith.run({src: filePaths}, function handleResult(err, result) {
        return err ? reject(err) : resolve(result);
      });
    })
  }

  appendFile(filename, res) {
    return new Promise((resolve, reject) => {
      const _imgMap = {}
      for (const key in res.coordinates) {
        const item = res.coordinates[key];
        _imgMap[path.basename(key)] = {
          ...item,
          x: item.x * -1,
          y: item.y * -1
        }
      }

      const _type = Object.keys(_imgMap).map((item) => `"${item}"`).join(' | ');
      const _filePath = path.resolve(this.root, this.outMapDir, `sprite.${filename}.style.${this.renderTs ? 'ts' : 'js'}`);
      const _imgPath = path.resolve(this.root, this.outMapDir, `sprite.${filename}.png`);

      const txt =
        (this.renderTs ? `export type T${filename[0].toLocaleUpperCase() + filename.slice(1)} = ${_type} \n` : '')
        + `export const ${filename}Style = ${JSON.stringify(_imgMap, null, 2)}`;

      fs.writeFileSync(_filePath, txt, 'utf-8');
      fs.writeFileSync(_imgPath, res.image);

      resolve();
    })
  }
}

module.exports = MixinImgWH;
