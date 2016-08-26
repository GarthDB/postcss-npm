import path from 'path';
import resolve from 'resolve';
import fs from 'fs';
import postcss from 'postcss';

const ABS_URL = /^url\(|:\/\//;
const QUOTED = /^['"]|['"]$/g;
const RELATIVE = /^\./;
const SEPARATOR = '/';
let shim;

function identity(value) {
  return value;
}

function isNpmImport(filepath) {
  // Do not import absolute URLs
  return !ABS_URL.test(filepath);
}

function hasOwn(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function createProcessor(plugins) {
  if (plugins) {
    if (!Array.isArray(plugins)) {
      throw new Error('plugins option must be an array');
    }
    return postcss(plugins);
  }
  return postcss();
}

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
  constructor(css, opts = {}) {
    this.opts = opts;
    this.css = css;
    this.root = opts.root || process.cwd();
    this.prefilter = opts.prefilter || identity;
    shim = opts.shim || {};
    this.alias = opts.alias || {};
    return this.inline({}, this.css);
  }
  inline(scope, css) {
    const imports = [];
    css.walkAtRules(atRule => {
      if (atRule.name !== 'import') return;
      const result = this.getImport(scope, atRule);
      if (result) {
        imports.push(result);
      }
    });

    return Promise.all(imports.map(importObj => {
      const processor = createProcessor(this.opts.plugins);
      return processor.process(importObj.contents, { from: importObj.from })
        .then(result =>
          this.inline(importObj.scope, result.root).then(() => {
            importObj.atRule.parent.insertBefore(importObj.atRule, result.root.nodes);
            importObj.atRule.remove();
          })
        );
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
}
