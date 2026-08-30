'use strict';
/**
 * #199 — the page ratio ceiling, read by both the engine (`layout.cjs`,
 * deciding whether a flow needs wrapping) and the validator
 * (`validator/families/extras.cjs`'s `P1`, checking the page it got). Its
 * own file, not a constant written in both, so the two can never quietly
 * drift onto different numbers — the same reason `validator/index.cjs`
 * warns whoever adds a spacing option to touch two places, not one written
 * twice. Kept out of `layout.cjs` itself so the validator — which never
 * otherwise depends on the engine's own code, only on the plan it produces
 * — can read this one number without pulling in the vendored ELK bundle.
 */
module.exports = { MAX_PAGE_RATIO: 3 };
