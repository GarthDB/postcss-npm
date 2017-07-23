import path from 'path';
import resolve from 'resolve';
import fs from 'fs';
import postcss from 'postcss';

const ABS_URL = /^url\(|:\/\//;
const QUOTED = /^['"]|['"]$/g;
const RELATIVE = /^\./;
const SEPARATOR = '/';
let shim;

/**
 *  Public: the most basic prefilter function that just returns what it is
 *  given. A placeholder that can be replaced using options.
 *
 *  * `value` {*} the value to be returned
 *
 *  ## Examples
 *
 *  ```js
 *  identity(true); //returns `true`.
 *  ```
 *
 *  Returns {*} just `value`.
 */
function identity(value) {
  return value;
}

/**
 *  Public: makes sure the import is not an absolute url.
 *
 *  * `filepath` {String} to test
 *
 *  ## Examples
 *
 *  ```js
 *  isNpmImport('://example.com'); // returns `false`.
 *  ```
 *
 *  Returns {Boolean} - `true` if not absolute, `false` if it is.
 */
function isNpmImport(filepath) {
  // Do not import absolute URLs
  return !ABS_URL.test(filepath);
}

/**
 *  Public: helper method to check if an object has a specific property.
 *
 *  * `obj` {Object} any object to test.
 *  * `prop` {String} property key.
 *
 *  ## Examples
 *
 *  ```js
 *  hasOwn({test: 'yup'}, 'test'); // returns `true`.
 *  ```
 *
 *  Returns {Boolean} `true` if `object` has a property named `prop`.
 */
function hasOwn(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 *  Public: checks if a PostCSS {Node} is a descendant of an atRule Node.
 *
 *  * `node` {Node}
 *
 *  ## Examples
 *
 *  ```js
 *  let query = isAtruleDescendant(atRule);
 *  ```
 *
 *  Returns {Boolean}
 */
function isAtruleDescendant(node) {
  let { parent } = node;
  let descended = false;

  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule') {
      descended = parent.params;
    }
    parent = parent.parent;
  }
  return descended;
}

export default class Import {
  /**
   *  Public: constructor for Import class.
   *
   *  * `css` {Root} PostCSS Root Node.
   *  * `opts` (optional) {Object} plugin options.
   *    * `root` {String} the root filepath directory.
   *    * `prefilter` {Function} an optional function that can manipulate the imported file before applying it. Expected to return new contents {String}.
   *      * `contents` {String} the contents of the
   *      * `filepath` {String} the path to the file.
   *    * `shim` {Object} an object of keys pertaining to strings in the @import statement and values that will replace them in the actual import.
   *    * `alias` {Object} nearly identitcal to `shim`
   *    * `includePlugins` {Boolean} when importing css, postcss plugins can be included in processing this contents.
   *    * `prepend` {Array} of {Strings} of additional CSS files that can be prepended before processing.
   *  * `result` {String}
   *
   *  Returns {Root} transformed PostCSS Root Node.
   */
  constructor(css, opts = {}, result) {
    this.css = css;
    this.opts = opts;
    this.processor = result.processor;
    this.processorOpts = result.opts;
    this.root = opts.root || process.cwd();
    this.prefilter = opts.prefilter || identity;
    shim = opts.shim || {};
    this.alias = opts.alias || {};
    this.includePlugins = opts.includePlugins || false;
    this.prepend = opts.prepend || [];
    if (!this.processorOpts.notFirst) this.prependImports();
    return this.inline({}, this.css);
  }
  prependImports() {
    const resultPrepend = [];
    this.prepend.forEach((importString) => {
      const atRule = postcss.parse(`@import "${importString}"`).first;
      resultPrepend.push(atRule);
    });
    this.css.prepend(resultPrepend);
  }
  inline(scope, css) {
    const imports = [];
    css.walkAtRules((atRule) => {
      if (atRule.name !== 'import') return;
      const result = this.getImport(scope, atRule);
      if (result) {
        imports.push(result);
      }
    });

    return Promise.all(imports.map((importObj) => {
      const processor = this.generateProcessor();
      this.processorOpts.from = importObj.from;
      this.processorOpts.notFirst = true;
      return processor.process(importObj.contents, this.processorOpts)
        .then((result) => {
          importObj.atRule.parent.insertBefore(importObj.atRule, result.root.nodes);
          importObj.atRule.remove();
        });
    }));
  }
  getImport(scope, atRule) {
    const file = this.resolveImport(atRule);
    if (!file) {
      return false;
    }
    let query = isAtruleDescendant(atRule);
    if (!query) {
      query = '0';
    }
    scope['0'] = scope['0'] || [];
    scope[query] = scope[query] || [];
    if (scope[query].indexOf(file) !== -1 || scope['0'].indexOf(file) !== -1) {
      atRule.remove();
      return false;
    }
    scope[query].push(file);
    const contents = this.prefilter(fs.readFileSync(file, 'utf8'), file);
    const from = path.relative(this.root, file);
    return { atRule, contents, scope, from };
  }
  resolveImport(atRule) {
    let name = atRule.params.replace(QUOTED, '');
    if (!isNpmImport(name)) {
      return null;
    }

    if (!RELATIVE.test(name)) {
      name = this.resolveAlias(name) || name;
    }
    const source = atRule.source.input.file;
    const dir = source ? path.dirname(source) : this.root;
    const file = resolve.sync(name, {
      basedir: dir,
      extensions: ['.css'],
      packageFilter: this.processPackage,
    });
    return path.normalize(file);
  }
  resolveAlias(name) {
    if (hasOwn(this.alias, name)) {
      return path.resolve(this.root, this.alias[name]);
    }

    const segments = name.split(SEPARATOR);
    if (segments.length > 1) {
      const current = segments.pop();
      const parent = this.resolveAlias(segments.join(SEPARATOR));
      if (parent) {
        return path.join(parent, current);
      }
    }

    return null;
  }
  processPackage(pkg) {
    pkg.main =
      (hasOwn(shim, pkg.name) && shim[pkg.name]) ||
          pkg.style || 'index.css';
    return pkg;
  }
  generateProcessor() {
    let plugins = this.processor.plugins;
    if (!this.includePlugins) {
      plugins = plugins.filter(plugin =>
        (plugin.postcssPlugin === 'postcss-npm')
      );
    }
    return postcss(plugins);
  }
}
