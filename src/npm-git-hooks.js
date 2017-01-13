'use strict';

const shell = require('shelljs');

const handlers = require('../lib/handlers');
const utils = require('../lib/utils');
const git = require('../lib/git');

module.exports = {run};

/**
 * @method findAllPackages(repoPath)
 * @desc finds all the packages (package.json) in the repository, from root to subfolders (excluding all external packages)
 * @param {String} root (absolute path to the repository folder)
 * @return {Array<Object>} list of package objects
 * @prop {String} package.name (name of the package.json folder)
 * @prop {String} package.absolute (full absolute path to package.json from root)
 * @prop {String} package.relative (relative path to package.json folder from root)
 */
function findAllPackages(root) {
  return utils.scandir(root, {pattern: ['package.json'], exclude: ['node_modules']})
    .filter(dir => Boolean(dir))
    .map(dir => {
      const absolute = utils.resolve(dir);
      const relative = absolute.replace(root, '.');
      const name = utils.basename(absolute);
      return {name, absolute, relative};
    });
}

/**
 * @method getPackageConfig(json, project)
 * @desc get the configuration object from package.json for npm-git-hooks tasks and fileTypes
 * @param {JSON} pkg
 * @param {String} hook
 * @return {Object} config
 */
function getPackageConfig(pkg) {
  const config = pkg && pkg['npm-git-hooks'];
  if (!config) {
    throw new handlers.NoConfigError(pkg.name);
  }
  return config;
}

/**
 * @method buildFilePattern(config, relative)
 * @desc build a file pattern according to fileTypes defined in the 'npm-git-hooks' property of package.json
 * @param {Object} config (the config property extracted from package.json)
 *  @prop {Array<String>} restrictions.folders
 *  @prop {Array<String>} restrictions.fileTypes
 * @param {String} relative (relative path to project folder)
 * @return {RegExp} regex
 */
function buildFilePattern(restrictions, relative) {
  relative = relative[relative.length - 1] === '/' ? relative.substr(0, relative.length - 1) : relative;
  let pattern = `(?:.+${relative}\\/)?`;
  let done = false;
  if (restrictions) {
    if (restrictions.folders) {
      const folders = restrictions.folders.map(f => {
        f = f[f.length - 1] === '/' ? f : `${f}/`;
        return f.replace(/^\.\//, '').replace('/', '\\/');
      });
      pattern += `(?:${folders.join(`|`)})`;
    }
    if (restrictions.fileTypes) {
      pattern += `.+\\.(?:${restrictions.fileTypes.join(`\\s+\\||`)})`;
      done = true;
    }
  }
  pattern += (done) ? '' : `.+`;
  return new RegExp(pattern, 'i');
}

/**
 * @method runTask(task, pkg)
 * @desc runs a task in the package.json folder they are defined in
 * @param {String} task (the task to be run)
 * @param {Object} pkg (the package.json info object)
 *  @prop {String} pkg.name
 *  @prop {String} pkg.absolute
 */
function runTask(task, pkg) {
  try {
    // Launch the task with i/o set to default shell
    process.chdir(pkg.absolute);
    console.log('**********\n');
    console.log(`npm-git-hooks: RUNNING: "${task}" in ${pkg.absolute}`);
    console.log('**********\n');
    shell.exec(task, {'stdio': [0, 1, 2]});
  } catch (e) {
    throw new handlers.RunTaskError(task, pkg.name);
  }
}

/**
 * @method runTasks(files, config, pkg)
 * @param {Object} config (the config object extracted from package.json)
 *  @prop {Array<String>} config.tasks (list of commands to run)
 * @param {Object} pkg (the package.json info object)
 *  @prop {String} pkg.name
 *  @prop {String} pkg.absolute
 * @param {Boolean} files (are there any files where we need to run a task?)
 * @param {String} operation
 */
function runTasks(config, pkg, files, operation) {
  if (files && config.tasks && config.tasks.length) {
    config.tasks.forEach(task => runTask(task, pkg));
  } else if (files) {
    throw new handlers.NoTaskError(operation, pkg.name);
  } else {
    throw new handlers.NoFileError(operation, pkg.name);
  }
}

/**
 * @method run(repoPath, fileList)
 * @description entry point for all hook scripts
 * @param {String} operation
 * @param {Array<String> || Boolean} fileList
 * @return {Promise}
 */
function run(operation, fileList) {
  const repoPath = git.getRootDir();
  const errors = [];
  const packages = findAllPackages(repoPath);
  console.log(packages);

  for (let i = 0; i < packages.length; i += 1) {
    const pkg = packages[i];
    try {
      const pkgPath = utils.resolve(pkg.absolute, 'package.json');
      const config = getPackageConfig(require(pkgPath));
      console.log(operation, config[operation]);
      const user = git.getUsername();
      if (config.restrictions['skip-users'].indexOf(user) >= 0) {
        console.log(`User ${user} does not need to run ${operation} tasks in ${pkg.name}, moving on...`);
        return;
      } else if (!config.enabled) {
        console.log(`Git hooks disabled for project ${pkg.name}, moving on...`);
        return;
      }
      const filePattern = buildFilePattern(config.restrictions, pkg.relative);
      const files = (typeof fileList === 'boolean') ? fileList : fileList.some(file => filePattern.exec(file.toString().trim()));
      runTasks(config[operation], pkg, files, operation);
    } catch (e) {
      if (e instanceof handlers.RunTaskError) {
        // We want to stop the process immediately with a falsy exit code if the error comes from running a task
        console.error('\n*************');
        console.error(e.message);
        console.error('Stacktrace:\n');
        console.error(e.stack);
        console.error('*************\n');
        process.exit(1);
      } else {
        // Otherwise let the errorCallback deal with the list of potential errors
        errors.push(e);
        handlers.errorCallback([e]);
      }
    }
  }

  if (!errors.length) {
    handlers.successCallback(operation);
  }
}
