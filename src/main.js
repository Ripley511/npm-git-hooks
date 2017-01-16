'use strict';

const shell = require('shelljs');
const colors = require('colors');

const handlers = require('../lib/handlers');
const utils = require('../lib/utils');
const git = require('../lib/git');
const Promise = require('bluebird');
const user = git.getUsername();

module.exports = {run};

/**
 * @method findAllPackages(repoPath)
 * @desc finds all the packages (package.json) in the repository, from root to subfolders (excluding all external packages)
 * @return {Array<Object>} list of package objects
 *** @prop {String} package.name (name of the package.json folder)
 *** @prop {String} package.absolute (full absolute path to package.json from root)
 *** @prop {String} package.relative (relative path to package.json folder from root)
 */
function findAllPackages() {
  const root = git.getRootDir();
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
 * @callback mapPackageConfig(pkg)
 * @desc get the configuration object from package.json for npm-git-hooks tasks and fileTypes
 * @param {Object} pkg
 * @return {Object} config
 */
function mapPackageConfig(pkg) {
  const json = require(utils.resolve(pkg.absolute, 'package.json'));
  const config = json && json['npm-git-hooks'];
  if (!config) {
    throw new handlers.NoConfigError(pkg.name);
  }
  config.pkg = pkg;
  config.enabled = (typeof config.enabled === 'undefined') ? true : config.enabled;
  return config;
}

/**
* @callback skipPackage(config)
* @desc checks if there is a reason to skip running hook on a package
* @param {Object} config
*  @prop {Array} config['skip-users']
*  @prop {Boolean} config.enabled
*  @prop {Object} config.pkg
*  @prop {String} config.pkg.name
* @return {Boolean}
*/
function skipPackage(config) {
  if (config['skip-users'].indexOf(user) >= 0) {
    console.log(`${colors.inverse('npm-git-hooks')} ${colors.cyan.inverse('SKIP')}
    User ${user} does not need to run tasks for project ${config.pkg.name}, moving on...`);
    return false;
  } else if (!config.enabled) {
    console.log(`${colors.inverse('npm-git-hooks')} ${colors.cyan.inverse('SKIP')}
    Git hooks disabled for project ${config.pkg.name}, moving on...`);
    return false;
  }
  return true;
}

/**
 * @callback fileMatch(config)
 * @desc checks if files from index matches the restrictions from config
 * @param {Object} config
 * @param {String} operation
 * @return {Boolean}
 */
function fileMatch(config, operation) {
  if (operation === 'pre-push' || operation === 'pre-commit') {
    const filePattern = utils.buildFilePattern(config);
    let fileList = [];
    try {
      if (operation === 'pre-commit') {
        fileList = git.getStagedFiles()
      } else if (operation === 'pre-push') {
        fileList = git.getCommitedFiles()
      }
    } catch (e) {
      console.log(e.message);
    }
    return fileList.some(file => filePattern.exec(file.toString().trim()));
  }
  return true;
}

/**
 * @method checkCommitMsg(config)
 * @desc checks the commit message against a pattern from config
 * @param {Object} config
 *  @prop {String} config['commit-msg']
 * @return {Promise}
 */
function checkCommitMsg(config) {
  if (config['commit-msg']) {
    const message = git.getCommitMessage();
    const pattern = new RegExp(config['commit-msg']);
    return new Promise((resolve, reject) => {
      if (pattern.test(message)) {
        resolve(['commit-msg']);
      } else {
        reject(new handlers.RunTaskError('commit-msg', config.pkg.name));
      }
    });
  } else {
    return Promise.resolve();
  }
}

/**
 * @method runTask(task, pkg)
 * @desc runs a task in the package.json folder they are defined in
 * @param {String} task (the task to be run)
 * @param {Object} pkg (the package.json info object)
 *  @prop {String} pkg.name
 *  @prop {String} pkg.absolute
 * @param {String} operation
 * @return {Promise}
 */
function runTask(task, pkg, operation) {
  return new Promise((resolve, reject) => {
    process.chdir(pkg.absolute);
    console.log(`${colors.inverse('npm-git-hooks')} ${colors.blue.inverse('RUNNING')} ${colors.magenta(operation)} "${task}" in ${pkg.absolute}`);
    shell.exec(task, {silent: false}, code => {
      if (code === 0) {
        console.log(`${colors.inverse('npm-git-hooks')} ${colors.green.inverse('SUCCESS')} ${colors.magenta(operation)} "${task}" in ${pkg.absolute}\n`)
        resolve(pkg);
      } else {
        reject(new handlers.RunTaskError(task, pkg.name, operation))
      }
    });
  });
}

/**
 * @method runTasks(files, config, pkg)
 * @param {Object} config (the config object extracted from package.json)
 *  @prop {Array<String>} config[operation].tasks (list of commands to run)
 *  @prop {Object} config.pkg
 * @param {String} operation
 * @return {Promise}
 */
function runTasks(config, operation) {
  const tasks = config[operation];
  if (operation === 'commit-msg') {
    return checkCommitMsg(config);
  }
  if (tasks && tasks.length) {
    return Promise.each(tasks, task => runTask(task, config.pkg, operation));
  } else {
    return Promise.reject(new handlers.NoTaskError(config.pkg.name, operation));
  }
}

/**
 * @method run(repoPath, fileList)
 * @description entry point for all hook scripts
 * @param {String} operation
 * @param {Array<String>} fileList
 * @return {Promise}
 */
function run(operation) {
  const configs = findAllPackages()
    .map(mapPackageConfig)
    .filter(skipPackage)
    .filter(config => fileMatch(config, operation));

  configs.forEach(config => {
    runTasks(config, operation).then(() => {
      handlers.successCallback(config.pkg, operation);
    }).catch(handlers.errorCallback);
  });
}
