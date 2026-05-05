export {
  discoverConfigLayers,
  projectConfigPath,
  userGlobalConfigPath,
} from '../shared/config-loader.js';

// Runtime compatibility surface. Config discovery feeds both retained runtime
// and core-v2 routing, so the implementation now lives in
// `src/shared/config-loader.ts`; old imports can keep using this wrapper.
