# npm-git-hooks

> Main git hooks with nodejs implementation for npm projects

### Information

This project is largely inspired by Gleb Bahmutov [pre-git package](https://github.com/bahmutov/pre-git).  
However, it was missing some important features, such as:
- Possibility to have multiple npm projects in your git repository
- Restrict the running tasks to specific file types or folders
- Disable the hook for specific users (ex: jenkins)

### Installation

```bash
$ npm install --save-dev npm-git-hooks
```

### Configuration

You need to fill the 'npm-git-hooks' config object in you package.json file.  

```json
{
  "scripts": {
    "build": "webpack --config webpack.conf.js",
    "test": "karma start"
  },
  "npm-git-hooks": {
    "enabled": true,
    "skip-users": ["jenkins"],
    "restrictions": {
      "fileTypes": ["js", "html"],
      "folders": ["src/app"]
    },
    "commit-msg": ".+",
    "post-checkout": ["npm install"],
    "post-commit": [],
    "post-merge": [],
    "pre-commit": ["npm run test"],
    "pre-push": ["npm run test", "npm run build"]
  }
}
```
