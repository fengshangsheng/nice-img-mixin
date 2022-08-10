const path = require("path");
const fs = require("fs");
const chokidar = require('chokidar');
const spritesmith = require('spritesmith');

const PluginName = 'MixinImgWH';

class MixinImgWH {
  root = '';
  resolveDir = {};
  outMapDir = '';
  deep = false;

  constructor({resolveDir, deep, outMapDir}) {
    this.resolveDir = resolveDir;
    this.outMapDir = outMapDir;
    this.deep = deep;
  }

  apply(compiler) {
    compiler.hooks.run.tapAsync(PluginName, async (compiler, cb) => {
      this.root = compiler.options.context;

      const promise = []
      for (const sprite in this.resolveDir) {
        const dir = path.resolve(this.root, this.resolveDir[sprite]);
        const mapFilePath = this.findFiles(dir);
        const res = await this.spritesmithRun(mapFilePath);

        this.appendConfigFile(sprite, res);
      }

      cb();
    })

    compiler.hooks.watchRun.tapAsync(PluginName, async (compiler, cb) => {
      this.root = compiler.options.context;


      const dirs = Object.keys(this.resolveDir).map((key) => {
        return path.resolve(this.root, this.resolveDir[key]);
      })

      console.log('dirs!!!!!!!!!!!!!!!!!!!!!!!!!!!!', dirs);

      // this._watcher = chokidar.watch(dirs, {
      //   cwd: this._options.cwd,
      //   ...this._options.options
      // });

      cb();
    })
  }

  findFiles(dirpath) {
    const files = fs.readdirSync(dirpath);
    let list = [];

    files.forEach((item) => {
      const filepath = path.resolve(dirpath, item);
      const stat = fs.statSync(filepath);

      if (stat.isDirectory() && this.deep) {
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

  appendConfigFile(filename, res) {
    let _imgMap = {}
    for (const key in res.coordinates) {
      _imgMap[path.basename(key)] = res.coordinates[key]
    }

    const _filePath = path.resolve(this.root, this.outMapDir, `sprite.${filename}.config.ts`);
    const _imgPath = path.resolve(this.root, this.outMapDir, `sprite.${filename}.png`);
    const _type = Object.keys(_imgMap).map((item) => `"${item}"`).join(' | ');
    _imgMap = JSON.stringify(_imgMap, null, 2);

    const txt =
      `export type TImgKey = ${_type} \n` +
      `export const imgMap = ${_imgMap}`;

    fs.writeFileSync(_filePath, txt, 'utf-8')
    fs.writeFileSync(_imgPath, res.image);
  }
}

module.exports = MixinImgWH;
