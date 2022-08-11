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
      await this.initSpritesmith();
      this.initWatch();
      cb();
    })
  }

  initSpritesmith() {
    return new Promise(async (resolve, reject) => {
      const promise = []
      for (const sprite in this.resolveDir) {
        await this.renderSpritesItem(sprite);
      }
      resolve();
    })
  }

  async initWatch() {
    // 全部需要解析的目录路径
    const dirs = Object.keys(this.resolveDir).map((key) => {
      return path.resolve(this.root, this.resolveDir[key]);
    })
    // 取消上一次的监听
    this._watcher && await this._watcher.close();
    // 初始化监听
    this._watcher = chokidar.watch(dirs, {ignoreInitial: true});
    this._watcher.on("all", (event, filepath) => {
      for (const sprite in this.resolveDir) {
        const dir = path.resolve(this.root, this.resolveDir[sprite]);

        if (filepath.indexOf(dir) === 0) {
          // 如果是多个文件夹同时变更，就记录
          this.loadingRenderItem = [...this.loadingRenderItem || [], sprite]
          this.shakeEvent(() => {
            // 根据记录变更的目录，重新生成相应的精灵图
            for (const item of this.loadingRenderItem) {
              this.renderSpritesItem(item);
            }
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

  shakeEvent(key, event, ms = 5000) {
    let flat = false;
    let timeout = 0;

    return (() => {
      flat && clearTimeout(timeout);
      flat = true;

      timeout = setTimeout(() => {
        flat = false;
        event();
      }, ms);
    })();
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
      let _imgMap = {}
      for (const key in res.coordinates) {
        _imgMap[path.basename(key)] = res.coordinates[key]
      }

      const _filePath = path.resolve(this.root, this.outMapDir, `sprite.${filename}.config.${this.renderTs ? 'ts' : 'js'}`);
      const _imgPath = path.resolve(this.root, this.outMapDir, `sprite.${filename}.png`);
      const _type = Object.keys(_imgMap).map((item) => `"${item}"`).join(' | ');
      _imgMap = JSON.stringify(_imgMap, null, 2);

      const txt =
        `export const imgMap = ${_imgMap}`
        + '\n'
        + (this.renderTs ? `export type TImgKey = ${_type}` : '')


      fs.writeFileSync(_filePath, txt, 'utf-8')
      fs.writeFileSync(_imgPath, res.image);

      resolve();
    })
  }
}

module.exports = MixinImgWH;
