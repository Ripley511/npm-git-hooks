'use strict'

module.exports = {
 NoTaskError, NoConfigError, NoFileError, RunTaskError,
 InstallError, PathNotFoundError, NoStreamError,
 NoCommitsError, NoStagedFileError,
 errorCallback, successCallback,
};

/**
 * @constructor NoTaskError(message)
 * @desc ErrorType constructor in case no tasks are found
 * @param {String} message
 */
function NoTaskError(message) {
  this.name = 'NoTaskError';
  this.message = message || 'No tasks were found';
  this.stack = (new Error()).stack;
}
NoTaskError.prototype = Object.create(Error.prototype);
NoTaskError.prototype.constructor = NoTaskError;

/**
 * @constructor NoConfigError(message)
 * @desc ErrorType constructor in case no config is found
 * @param {String} message
 */
function NoConfigError(message) {
  this.name = 'NoConfigError';
  this.message = message || 'Could not find a config property';
  this.stack = (new Error()).stack;
}
NoConfigError.prototype = Object.create(Error.prototype);
NoConfigError.prototype.constructor = NoConfigError;

/**
 * @constructor NoFileError(message)
 * @desc ErrorType constructor in case no file match the fileTypes pattern list
 * @param {String} message
 */
function NoFileError(message) {
  this.name = 'NoFileError';
  this.message = message || 'No file matches the specified extension';
  this.stack = (new Error()).stack;
}
NoFileError.prototype = Object.create(Error.prototype);
NoFileError.prototype.constructor = NoFileError;

/**
 * @constructor RunTaskError(task, project)
 * @desc ErrorType constructor in case an error occurs while performing a task
 * @param {String} task
 * @param {String} project
 */
function RunTaskError(task, project) {
  this.name = 'RunTaskError';
  this.task = task || 'unknown';
  this.project = project || 'unknown';
  this.message = `npm-git-hooks: FAILURE: git operation not permitted because task ${this.task} failed for project ${this.project}`;
  this.stack = (new Error()).stack;
}
RunTaskError.prototype = Object.create(Error.prototype);
RunTaskError.prototype.constructor = RunTaskError;

/**
 * @constructor InstallError(message)
 * @desc ErrorType constructor if installation fails
 * @param {String} message
 */
function InstallError(message) {
  this.name = 'InstallError';
  this.message = message || 'Error during installation';
  this.stack = (new Error()).stack;
}
InstallError.prototype = Object.create(Error.prototype);
InstallError.prototype.constructor = InstallError;

/**
 * @constructor PathNotFoundError(path)
 * @desc ErrorType constructor in case a file or directory does not exist
 * @param {String} path
 * @param {String} filename
 */
function PathNotFoundError(path, filename) {
  this.name = 'PathNotFoundError';
  this.message = `npm-git-hooks: ERROR: could not find ${filename || 'file or directory'} at ${path}`;
  this.stack = (new Error()).stack;
}
PathNotFoundError.prototype = Object.create(Error.prototype);
PathNotFoundError.prototype.constructor = PathNotFoundError;

/**
 * @constructor NoStreamError(type)
 * @desc ErrorType constructor when a read/write operation goes wrong
 * @param {String} type (read or write)
 * @param {String} src
 * @param {String} dest
 */
 function NoStreamError(type, src, dest) {
   this.name = 'NoStreamError';
   this.message = `npm-git-hooks: ERROR: Could not ${type} ${src} ${dest ? 'to ' : ''} ${dest}`;
   this.stack = (new Error()).stack;
 }
NoStreamError.prototype = Object.create(Error.prototype);
NoStreamError.prototype.constructor = NoStreamError;

/**
 * @constructor NoCommitsError()
 * @desc ErrorType constructor when there is no commit to run a task on
 * @param {String} repoPath
 * @param {String} branch
 */
 function NoCommitsError(repoPath, branch) {
   this.name = 'NoCommitsError';
   this.message = `No commits found in repository ${repoPath} for the branch ${branch}, moving on...`;
   this.stack = (new Error()).stack;
 }
NoCommitsError.prototype = Object.create(Error.prototype);
NoCommitsError.prototype.constructor = NoCommitsError;

/**
 * @constructor NoStagedFileError()
 * @desc ErrorType constructor when there is no staged files to run a task on
 * @param {String} repoPath
 */
 function NoStagedFileError(repoPath) {
   this.name = 'NoStagedFileError';
   this.message = `No staged files found in repository ${repoPath}, moving on...`;
   this.stack = (new Error()).stack;
 }
NoStagedFileError.prototype = Object.create(Error.prototype);
NoStagedFileError.prototype.constructor = NoStagedFileError;

/**
 * @callback errorCallback(errors)
 * @desc manages errors after running tasks
 * @param {Array<String>} errors
 */
function errorCallback(errors) {
  errors.forEach(e => {
    switch (e) {
      case (e instanceof NoConfigError):
      case (e instanceof NoTaskError):
      case (e instanceof NoFileError):
      case (e instanceof NoCommitsError):
        // We need to let git roll if the error is not related to running a task
        console.log(`npm-git-hooks: INFO: ${e.message}`);
        break;
      default:
        // If the error comes from somewhere else, print the error stack and stop everything
        console.error(e.message);
        console.error(e.stack);
        process.exit(1);
    }
  });
  // If there is no serious errors, we can safely exit and let git do its job
  successCallback();
}

/**
 * @method successCallback(operation)
 * @desc printing method and exits with success status code
 * @param {String} operation
 */
function successCallback(operation) {
  operation = (operation) ? ` ${operation.toUpperCase()}:` : '';
  console.log('\n********************************************************************************************************\n');
  console.log(`npm-git-hooks:${operation} All tasks successful!`);
  console.log('\n********************************************************************************************************\n');
  process.exit(0);
}
