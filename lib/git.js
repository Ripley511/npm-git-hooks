'use strict';

const shell = require('shelljs');
const fs = require('fs');
const utils = require('./utils');
const handlers = require('./handlers');

module.exports = {
  getRootDir,
  getHooksDir,
  checkUpstream,
  getCommitedFiles,
  getStagedFiles,
  getBranch,
  getUsername,
};

// Cache the root directory and the username for convenience and performance
let rootDir;
let username;

/**
 * @method isTruthy(item)
 * @desc utility method to check if an item is truthy
 * @param {Any} item
 * @return {Boolean}
 */
function isTruthy(item) {
  return Boolean(item);
}

/**
 * @method getRootDir()
 * @desc gets the git root directory path (where git init was run)
         and sets the rootDir variable
 * @return {String} path to rootDir
 * @throws {Error} if no git root repository is found
 */
function getRootDir(dir) {
  if (rootDir) return rootDir;
  console.log('after cached value', rootDir);
  dir = dir || __dirname;
  try {
    rootDir = utils.read(dir).filter(f => f === '.git')[0];
    return (rootDir) ? dir : getRootDir(utils.dirname(dir));
  } catch (e) {
    throw new Error(`npm-git-hooks: FAILED: Could not find git repository from ${process.cwd()}`);
  }
}

/**
 * @method getHooksDir()
 * @desc gets the hooks directory from .git folder
         > creates it if it doesn't exist
         > replaces the .git/hooks file with a .git/hooks folder
 * @return {String}
 * @throws {Error} if there is no git repository or if file system operations are not possible
 */
function getHooksDir() {
  rootDir = rootDir || getRootDir();
  const gitHooksDir = utils.resolve(rootDir, '.git', 'hooks');

  try {
    if (!utils.isADirectory(gitHooksDir)) {
      if (utils.isAFile(gitHooksDir)) {
        fs.unlinkSync(gitHooksDir);
      }
      fs.mkdirSync(gitHooksDir);
    }
    return gitHooksDir;
  } catch (e) {
    throw new Error(`npm-git-hooks: FAILED! Cannot locate or create .git/hooks folder in repository ${utils.basename(rootDir)}`);
  }
}

/**
 * @method getBranch()
 * @desc gets the current branch
 * @return {String}
 */
function getBranch() {
  try {
    return shell.exec('git rev-parse --abbrev-ref HEAD', {silent: true}).trim();
  } catch (e) {
    throw new Error(`npm-git-hooks: ERROR: Could not locate your current branch`);
  }
}

/**
 * @method checkUpstream(remote, branch)
 * @desc check if an upstream is configured for the current branch
 * @param {String} remote (name of the remote)
 * @param {String} branch (name of the branch)
 * @return {Boolean} result
 */
function checkUpstream(remote, branch) {
  try {
    shell.exec(`git log ${remote}/${branch}..HEAD`, {silent: true}).trim();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * @method getCommitedFiles(remote, branch, repoPath, upstream)
 * @desc get the files about to be pushed
 * @param {String} remote (name of the remote)
 * @param {String} branch (name of the branch)
 * @param {Boolean} upstream (is the upstream configured?)
 * @return {Array} files (relative paths from repoPath to files about to be pushed)
 */
function getCommitedFiles(remote, branch, upstream) {
  try {
    const repoPath = getRootDir();
    let commits;
    let cmd;
    if (upstream) {
      commits = shell.exec(`git log ${remote}/${branch}..HEAD`, {silent: true})
        .trim().split('\n').filter(isTruthy);
      cmd = `git diff --stat --cached ${remote}/${branch}`;
    } else {
      commits = shell.exec('git log --branches --remotes --simplify-by-decoration --oneline --format=format:%H', {silent: true})
        .trim().split('\n').filter(isTruthy);
      const commit = commits[1] || commits[commits.length - 1];
      cmd = `git diff --stat --cached ${commit}`;
    }
    if (!commits || commits && !commits.length) {
      throw new handlers.NoCommitsError(repoPath, branch);
    }
    // Get the files being pushed
    process.chdir(repoPath);
    return shell.exec(cmd, {silent: true}).trim().split('\n').filter(isTruthy);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

/**
 * @method getStagedFiles(repoPath)
 * @desc lists all staged files about to be committed
 * @return {Array}
 */
function getStagedFiles() {
  const repoPath = getRootDir();
  process.chdir(repoPath);
  const stagedFiles = shell.exec('git diff --cached --name-only', {silent: true})
    .trim().split('\n').filter(isTruthy);
  if (!stagedFiles || stagedFiles && !stagedFiles.length) {
    throw new handlers.NoStagedFileError(repoPath);
  }
  return stagedFiles;
}

/**
 * @method getUsername()
 * @desc gets the git username
 * @return {String}
 */
function getUsername() {
  username = username || shell.exec('git config user.name', {silent: true}).trim();
  return username;
}
