import * as React from 'react';
import * as ReactDOM from 'react-dom';
import jsxRuntime from 'react/jsx-runtime';

import type { ClosureFn, RequireFn, ResolveConfig } from './types';
import { normalizePath } from './normalize-path';

const emptyExport = {};

export const mergeResolve = (resolve: Partial<ResolveConfig> | undefined = {}) => {
  const mergedResolve: ResolveConfig = {
    extensions: ['.js', ...(resolve.extensions || [])],
    externals: {
      ...resolve.externals,
    },
    cdnPrefix: 'https://unpkg.com',
    ...resolve,
  };
  return mergedResolve;
};

export const createClosureMap = (): Record<string, ClosureFn> => {
  const closureMap: Record<string, ClosureFn> = {
    'react': () => React,
    'react-dom': () => ReactDOM,
    'react/jsx-runtime': () => jsxRuntime,
  };
  return closureMap;
};

export const codeToClosure = (code: string, fileName: string) => {
  // Is there a better way to do this?
  // eslint-disable-next-line no-eval
  return eval(`(_require) => {
    const require = (path) => _require(path, '${fileName}');
    const module = {};
    const exports = {};
    ${code}
    return module.exports ?? exports;
  }`);
};

export const createRequireFn = (
  closureMap: Record<string, ClosureFn | undefined>,
  requireFn: RequireFn | undefined,
  resolve: ResolveConfig,
): RequireFn => {
  const fn = (path: string, currentFileName: string) => {
    path = normalizePath(path, currentFileName);
    if (requireFn) {
      return requireFn(path, currentFileName);
    }
    if (/\.(?:css|less|s[ac]ss|stylus)$/.test(path)) {
      return emptyExport;
    }
    const tried: string[] = [path];
    let closure = closureMap[path];
    for (const extension of resolve.extensions) {
      if (closure) {
        break;
      }
      const pathWithExtension = `${path}${extension}`;
      closure = closureMap[pathWithExtension];
      tried.push(pathWithExtension);
    }
    for (const extension of resolve.extensions) {
      if (closure) {
        break;
      }
      const pathWithExtension = `${path}/index${extension}`;
      closure = closureMap[pathWithExtension];
      tried.push(pathWithExtension);
    }
    if (!closure) {
      throw new Error(`Cannot find module '${path}' (tried ${tried.join(', ')})`);
    }
    return closure(fn);
  };

  return fn;
};
