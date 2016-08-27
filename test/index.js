import test from 'ava';
import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import sass from 'node-sass';
import { SourceMapConsumer } from 'source-map';
import inheritParser from 'postcss-inherit-parser';
import perfectionist from 'perfectionist';
import postcssNPM from '../src/index';

function read(file) {
  return fs.readFileSync(`./expected/${file}.css`, 'utf8').trim();
}

function runNPM(input, opts, parserOpts = {}) {
  return postcss([
    postcssNPM(opts),
    perfectionist({ indentSize: 2, maxAtRuleLength: false, maxSelectorLength: 1 }),
  ]).process(input, parserOpts);
}

test('Import relative source file', (t) => {
  const input = '@import "./test";';
  return runNPM(input, {}, { from: 'file.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.test {\n  content: "Test file";\n}');
  });
});

test('Use the same parsing options on imports', (t) => {
  const input = '@import "parser";';
  return postcss([
    postcssNPM(),
    perfectionist({ indentSize: 2, maxAtRuleLength: false, maxSelectorLength: 1 }),
  ]).process(input, { parser: inheritParser, from: 'index.css' })
  .then(result => {
    t.deepEqual(
      result.css.trim(),
      '.b:before {\n  content: "";\n}\n\n.a {\n  inherit: .b:before;\n}'
    );
  });
});

test('Import package', (t) => {
  const input = '@import "test";';
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.test {\n  content: "Test package";\n}');
  });
});

test('Import package with custom style file', (t) => {
  const input = '@import "custom";';
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.custom {\n  content: "Custom package";\n}');
  });
});

test('Import files imported from imported package', (t) => {
  const input = '@import "nested";';
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.test {\n  content: "From nested test package";\n}');
  });
});

test('Import files imported from imported package', (t) => {
  const input = "@import './test';";
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.test {\n  content: "Test file";\n}');
  });
});

test('Import 2 packages with correct scope', (t) => {
  const input = '@import "custom";\n@import "./test";';
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(),
    '.custom {\n  content: "Custom package";\n}\n\n.test {\n  content: "Test file";\n}');
  });
});

test('Import package in @media', (t) => {
  const input =
  '@media (min-width: 320px) {@import "test";}@media (min-width: 640px) {@import "test";}';
  const expected = read('media').trim();
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), expected);
  });
});
test('Ignore import from @media if imported in outer scope', (t) => {
  const input =
  '@import "test";\n@media (min-width: 320px) { @import "test"; }';
  const expected = read('media.outerscope').trim();
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), expected);
  });
});

test('Skip absolute URLs', (t) => {
  const input = '@import "http://example.com/example.css";';
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), input);
  });
});

test('Skip imports using url()', (t) => {
  const input = '@import url(test.css);';
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), input);
  });
});

test('Include source file names in output', (t) => {
  const input = '@import "test";';
  return runNPM(input, {}, { from: 'index.css' })
  .then(result => {
    const resultPath = path.normalize(result.root.nodes[0].source.input.file);
    const expectedPath = path.join(__dirname, 'node_modules/test/index.css');
    t.deepEqual(resultPath, expectedPath);
  });
});

test('Use file names relative to root', (t) => {
  const input = '@import "test";';
  return runNPM(input, { root: path.join(__dirname, 'test') }, { from: 'index.css' })
  .then(result => {
    const resultPath = path.normalize(result.root.nodes[0].source.input.file);
    const expectedPath = path.join(__dirname, '..', 'node_modules/test/index.css');
    t.deepEqual(resultPath, expectedPath);
  });
});

test('Use shim config option', (t) => {
  const input = '@import "shimmed";';
  return runNPM(input, { shim: { shimmed: 'styles.css' } }, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.shimmed {\n  content: "Shimmed package";\n}');
  });
});

test('Use alias config option', (t) => {
  const input = '@import "tree";';
  return runNPM(input, { alias: { tree: 'styles/index.css' } }, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.test {\n  content: "Test file";\n}');
  });
});

test('Import index file in aliased directory', (t) => {
  const input = '@import "util";';
  return runNPM(input, { alias: { util: 'styles' } }, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.test {\n  content: "Test file";\n}');
  });
});

test('Import file in aliased directory', (t) => {
  const input = '@import "util/index";';
  return runNPM(input, { alias: { util: 'styles' } }, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.test {\n  content: "Test file";\n}');
  });
});

test('Allow prefiltering input CSS (e.g. css-whitespace)', (t) => {
  const input = '@import "./styles/index-unfiltered.css";';
  function replacer(code) {
    return code.replace('$replaceThis', 'content');
  }
  return runNPM(input, { prefilter: replacer }, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.test {\n  content: "Test file";\n}');
  });
});

test('Prefilter nested includes', (t) => {
  const input = '@import "./styles/nested-unfiltered.css";';
  function replacer(code) {
    return code.replace('$replaceThis', 'content');
  }
  return runNPM(input, { prefilter: replacer }, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.test {\n  content: "Test file";\n}');
  });
});

test('Provide filename as second arg to prefilter', (t) => {
  const input = '@import "sassy";';
  function renderSass(code, file) {
    let result = code;
    if (path.extname(file) === '.scss') {
      result = sass.renderSync({ data: code }).css.toString();
    }
    return result;
  }
  return runNPM(input, { prefilter: renderSass }, { from: 'index.css' })
  .then(result => {
    t.deepEqual(result.css.trim(), '.bashful {\n  color: red;\n}');
  });
});

test('Include source maps', (t) => {
  const input = '@import "test";';
  return runNPM(input, {}, { from: 'index.css', map: { inline: false } })
  .then(result => {
    const imported = 'node_modules/test/index.css';
    const map = new SourceMapConsumer(result.map.toString());
    const pos = map.originalPositionFor({ line: 1, column: 0 });
    t.deepEqual(pos, { source: imported, line: 1, column: 0, name: null });
  });
});

test('Include source maps again', (t) => {
  const input = '@import "test";';
  return runNPM(input, {}, { from: 'index.css', map: { inline: false } })
  .then(result => {
    const imported = 'node_modules/test/index.css';
    const map = new SourceMapConsumer(result.map.toString());
    const pos = map.originalPositionFor({ line: 2, column: 2 });
    t.deepEqual(pos, { source: imported, line: 2, column: 4, name: null });
  });
});

test('Prepend file imports to css before processing', (t) => {
  const input = '.basic-css{property:value;}';
  const expected = read('prepend');
  return runNPM(input, { prepend: ['test', 'custom'] }, { from: 'index.css' })
  .then(result => {
    t.is(result.css.trim(), expected);
  });
});
