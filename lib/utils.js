const path = require('path');
const fs = require('fs');
const handlers = require('./handlers');

module.exports = {
  resolve: path.resolve,
  dirname: path.dirname,
  join: path.join,
  basename: path.basename,
  symlink: fs.symlinkSync,
  remove: fs.unlinkSync,
  isAtRoot, isADirectory, isAFile,
  stripNodeModules,
  read, write, scandir, writeToFile,
  findPackage,
  buildFilePattern,
};

/**
 * @method isAtRoot(dir)
 * @desc checks if the given directory is the system root directory
 * @param {String} dir
 * @return {Boolean}
 */
function isAtRoot(dir) {
  return dir && typeof dir === 'string' && (dir === path.sep || dir === '/');
}

/**
 * @method isADirectory(path)
 * @desc checks if the given path is an existing directory
 * @param {String} path
 * @return {Boolean}
 */
function isADirectory(path) {
  return path && typeof path === 'string' &&
    fs.existsSync(path) && fs.statSync(path).isDirectory();
}

/**
 * @method isAFile(path)
 * @desc checks if the given path is an existing file
 * @param {String} path
 * @return {Boolean}
 */
function isAFile(path) {
  return path && typeof path === 'string' &&
    fs.existsSync(path) && fs.statSync(path).isFile();
}


/**
 * @method stripNodeModules(dir)
 * @desc utility method to jump to the parent directory of node_modules when dir
 is inside a node_modules folder
 * @param {String} dir
 * @return {String} dir
 */
function stripNodeModules(dir) {
  const index = dir.indexOf('node_modules');
  return (index >= 0) ? dir.substring(0, index) : dir;
}

/**
 * @method read(path)
 * @desc shortcut method to list files in a directory OR read a file
 * @param {String} path
 * @return {String} content of file if path is a file
 * @return {Array<String>} content of directory if path is a directory
 * @throws {PathNotFoundError} if path does not exist
 */
function read(path) {
  if (isADirectory(path)) {
    return fs.readdirSync(path);
  } else if (fs.existsSync(path)) {
    return fs.readFileSync(path);
  } else {
    throw new handlers.PathNotFoundError("Path does not exist");
  }
}

/**
 * @method write(dest, src, options)
 * @desc shortcut method to copy/paste a source file to destination file
 * @param {String} dest (path to destination file)
 * @param {String} src (path to source file)
 * @param {Object} options (optional)
 * @return {Null}
 * @throws {PathNotFoundError} if src file does not exist
 * @throws {Error} if src is not readable
 * @throws {Error} if dest is not writable
 */
function write(dest, src, options) {
  options = options || {};
  options.flags = options.flags || 'w';
  options.defaultEncoding = options.defaultEncoding || 'utf8';
  options.mode = options.mode || 0o755;
  options.autoClose = true;
  const reader = fs.createReadStream(src);
  const writer = fs.createWriteStream(dest, options);
  reader.pipe(writer);
  reader.on('error', err => {
    console.error(err.stack);
    throw new handlers.NoStreamError('read', src);
  });
  writer.on('error', err => {
    console.error(err.stack);
    throw new handlers.NoStreamError('write', src, dest);
  });
}

/**
 * @method writeToFile(dest, str, options)
 * @desc shortcut method to write a string to a file
 * @param {String} dest
 * @param {String} str
 * @param {Object} options
 */
function writeToFile(dest, str, options) {
  options = options || {};
  options.flag = options.flag || 'w';
  options.encoding = options.encoding || 'utf8';
  options.mode = options.mode || 0o666;
  fs.writeFileSync(dest, str, options);
}

/**
 * @method scandir(dir, filter)
 * @desc utility method to recursively scan the contents of a directory and all
 its sub-directories, limiting the search with a filter
 * @param {String} dir
 * @param {Object} filter
 * @param {Array<String>} filter.pattern (a list of patterns to include in search)
 * @param {Array<String>} filter.exclude (a list of patterns to exclude from search)
 * @return {Array<String>} list of paths
 */
function scandir(dir, filter) {
  dir = (dir[dir.length - 1] === path.sep) ? dir : `${dir}${path.sep}`;
  filter.pattern = filter.pattern || [];
  filter.exclude = filter.exclude || [];
  const pattern = new RegExp(`(${filter.pattern.join('|')})`, 'i');
  const exclude = new RegExp(`(${filter.exclude.join('|')})`, 'i');
  return recursive(dir, []);

  function recursive(dir, list) {
    list = list || [];
    read(dir).forEach(sub => {
      if (isADirectory(`${dir}${sub}`) && !exclude.test(sub)) {
        list = recursive(`${dir}${sub}${path.sep}`, list);
      } else if (pattern.test(sub)) {
        list.push(dir);
      }
    });
    return list;
  }
}

/**
 * @method findPackage(dir)
 * @desc recursive finds the package.json file
 * @param {String} dir
 * @return {String} path to package.json file
 * @throws {PathNotFoundError} if package.json is not found anywhere
 */
function findPackage(dir) {
  dir = dir || stripNodeModules(__dirname);
  if (isAtRoot(dir) || !isADirectory(dir)) throw new handlers.PathNotFoundError(dir, 'package.json');

  const pkg = read(dir).filter(f => f.indexOf('package.json') >= 0)[0];
  return (pkg) ? path.resolve(dir, 'package.json') : findPackage(path.dirname(dir));
}

/**
 * @method buildFilePattern(config, relative)
 * @desc build a file pattern according to fileTypes defined in the 'npm-git-hooks' property of package.json
 * @param {Object} config (the config property extracted from package.json)
 *  @prop {Array<String>} restrictions.folders
 *  @prop {Array<String>} restrictions.fileTypes
 *  @prop {Object} config.pkg
 * @return {RegExp} regex
 */
function buildFilePattern(config) {
  const relative = config.pkg.relative[config.pkg.relative.length - 1] === '/'
    ? config.pkg.relative.substr(0, config.pkg.relative.length - 1)
    : config.pkg.relative;
  let pattern = `(?:.+${relative}\\/)?`;
  let done = false;
  if (config.restrictions) {
    if (config.restrictions.folders) {
      const folders = config.restrictions.folders.map(f => {
        f = f[f.length - 1] === '/' ? f : `${f}/`;
        return f.replace(/^\.\//, '').replace('/', '\\/');
      });
      pattern += `(?:${folders.join(`|`)})`;
    }
    if (config.restrictions.fileTypes) {
      pattern += `.+\\.(?:${config.restrictions.fileTypes.join(`\\s+\\||`)})`;
      done = true;
    }
  }
  pattern += (done) ? '' : `.+`;
  return new RegExp(pattern, 'i');
}
