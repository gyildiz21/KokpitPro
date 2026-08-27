// Deliberately a .js file: the repository tsconfig only covers kokpit/**/*.ts,
// so this intentionally broken import must not surface in `npm run typecheck`,
// while dependency-cruiser still sees the literal specifier and reports it as
// couldNotResolve.
import { nothing } from 'a-missing-npm-package-for-fixture';

console.log(nothing);
