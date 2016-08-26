import postcss from 'postcss';
import Import from './import';

export default postcss.plugin('postcss-npm',
  (opts = {}) =>
    (css, result) =>
      new Import(css, opts, result)
);
