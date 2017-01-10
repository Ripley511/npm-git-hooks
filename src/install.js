'use strict';

const git = require('../lib/git');
const utils = require('../lib/utils');
const handlers = require('../lib/handlers');

let gitHooksDir;
try {
  gitHooksDir = git.getHooksDir();
} catch (e) {
  console.error(e.message);
  // Immediately stop the script if there is no git repository and/or no .git/hooks folder
  process.exit(1);
}

function isSelfInstall() {
  return process.cwd() === utils.resolve(__dirname, '..');
}

/**
 * @method getHooks()
 * @desc gets the hooks files stored in hooks directory
 * @param {Array<String>} hooksNames
 * @return {Array<Object>} a list of hooks path and name
 *** @prop {String} hook.path (absolute path of the hook file)
 *** @prop {String} hook.name (name of the hook)
 */
function getHooks(hooksNames) {
  const sourceHooksDir = utils.resolve(__dirname, '..', 'hooks');
  try {
    const hooksFiles = utils.read(sourceHooksDir);
    return hooksFiles.filter(f => hooksNames.indexOf(f) >= 0).map(hook => {
      return {
        path: utils.resolve(sourceHooksDir, hook),
        name: utils.basename(hook),
      };
    });
  } catch (e) {
    throw new handlers.InstallError(`npm-git-hooks: ERROR! No hooks were found in ${utils.dirname(sourceHooksDir)}`);
  }
}

/**
 * @method installHook(hook)
 * @desc installs a source hook into .git/hooks directory
 * @param {Object} hook
 *  @prop {String} hook.name
 *  @prop {String} hook.path
 * @throws {Error} if hook has no name or path property
 * @throws {PathNotFoundError} if hook.path is not a file
 */
function installHook(hook) {
  if (!hook.name || !hook.path) throw new Error('Invalid hook object');
  if (!utils.isAFile(hook.path)) throw new handlers.PathNotFoundError(hook.path);

  const destHookFile = utils.resolve(gitHooksDir, hook.name);
  console.log(`npm-git-hooks: INFO: Found '${hook.name}' git hook, installing...`);

  utils.write(destHookFile, hook.path);
}

(function(hooks) {
  try {
    // Get the hooks files path
    const hooksFiles = getHooks(hooks);
    // Get the package.json path
    const pkgPath = utils.findPackage();
    // Get the package.json object
    const pkg = require(pkgPath);
    if (!pkg['npm-git-hooks']) {
      console.log(`npm-git-hooks: INFO: Building empty configuration object in package.json`);
      pkg['npm-git-hooks'] = {};
      pkg['npm-git-hooks'].enabled = true;
      pkg['npm-git-hooks'].restrictions = {
        fileTypes: [],
        folders: [],
        'skip-users': [],
      };
      hooks.forEach(hook => {
        // Build an empty object for every existing hook
        pkg['npm-git-hooks'][hook] = {
          tasks: [],
        };
      });
      // Replace the old package.json file
      utils.writeToFile(pkgPath, JSON.stringify(pkg, null, 2));
    }
    // Copy our hooks in the .git/hooks folder
    hooksFiles.forEach(installHook);
    if (isSelfInstall()) {
      console.log("Installing inside self, copying symlinks...");
      const binDir = utils.resolve(__dirname, '..', 'bin');
      utils.read(binDir).forEach(hook => {
        const src = utils.resolve(binDir, hook);
        const dest = utils.resolve(__dirname, '..', 'node_modules', '.bin', hook);
        if (utils.isAFile(dest)) utils.remove(dest);
        utils.symlink(src, dest);
      });
    }
  } catch (e) {
    console.error(e.message);
    console.error(e.stack);
    process.exit(1);
  }
})([
  'post-checkout',
  'post-commit',
  'post-merge',
  'pre-commit',
  'pre-push',
]);
