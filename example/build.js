var postcss = require('postcss');
var postcssNpm = require('..');
var fs = require('fs');
var path = require('path');

var entry = path.join(__dirname, 'main.css');
var outFile = path.join(__dirname, 'compiled.css');

var input = fs.readFileSync(entry, 'utf8');

postcss([postcssNpm()])
  .process(input,
    {
      from: path.relative(__dirname, entry),
      to: path.relative(__dirname, outFile),
      map: true
    }
  )
  .then(function(result) {
    fs.writeFileSync(outFile, result.css, 'utf8');
  });
