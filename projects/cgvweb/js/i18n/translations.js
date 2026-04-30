// @ts-check
// Aggregator — pulls each locale from its own file under ./locales/. Splitting
// per-locale keeps diffs scoped (a French copy edit doesn't touch the
// Norwegian table) and lets tests/i18nCoverage.test.mjs assert that every key
// in `en` (the source of truth) is present in fr/no/pt.
import en from './locales/en.js';
import fr from './locales/fr.js';
import no from './locales/no.js';
import pt from './locales/pt.js';

/** @type {Record<string, Record<string, string>>} */
export const TRANSLATIONS = { en, fr, no, pt };
