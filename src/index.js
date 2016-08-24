import postcss from 'postcss';
import Import from './import';

export default postcss.plugin('postcss-npm',
  (opts = {}) =>
    (css) =>
      new Import(css, opts)
);
