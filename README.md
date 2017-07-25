# PostCSS NPM

[![Build Status](https://travis-ci.org/GarthDB/postcss-npm.svg?branch=master)](https://travis-ci.org/GarthDB/postcss-npm) [![codecov](https://codecov.io/gh/GarthDB/postcss-npm/branch/master/graph/badge.svg)](https://codecov.io/gh/GarthDB/postcss-npm) [![Dependency Status](https://david-dm.org/GarthDB/postcss-npm.svg)](https://david-dm.org/GarthDB/postcss-npm) [![Inline docs](http://inch-ci.org/github/GarthDB/postcss-npm.svg?branch=master)](http://inch-ci.org/github/GarthDB/postcss-npm) [![npm version](https://badge.fury.io/js/postcss-npm.svg)](https://badge.fury.io/js/postcss-npm)

---

<a href="http://postcss.org/"><img align="right" width="95" height="95"
     title="Philosopher’s stone, logo of PostCSS"
     src="http://postcss.github.io/postcss/logo.svg"></a>

Import CSS styles from NPM modules using [postcss](https://github.com/postcss/postcss).

This lets you use `@import` CSS using the same rules you use for `require` in Node. Specify the CSS file for a module using the `style` field in `package.json` and use `@import "my-module";`, or specify the file name in the module, like `@import "my-module/my-file";`. You can also require files relative to the current file using `@import "./my-file";`.

An `@import` will be processed so that the file referenced will have been imported in the current scope at the point of the `@import`. If a file has been previously imported in the current scope, that file will not be imported again. New scopes are created in a block such as a `@media` block. Child blocks will not duplicate imports that have been imported in the parent block, but may duplicate imports that are imported in a sibling block (since they may not have effect otherwise).

You can use source maps to show which file a definition originated from when debugging in a browser. To include inline source maps, use `.toString({ sourcemap: true })` on the rework object when generating the output.

Note that to get correct import paths you must set the `source` option to the source file name when parsing the CSS source (usually with rework). If the `source` path is relative, it is resolved to the `root` option (defaults to the current directory). The `source` path is used to find the directory to start in when finding dependencies.
