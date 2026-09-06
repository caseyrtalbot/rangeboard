import relativeLinks from 'markdownlint-rule-relative-links'

export default {
  globs: ['**/*.md'],
  ignores: ['node_modules/**', 'dist/**', '.claude/**', '.git/**'],
  customRules: [relativeLinks],
}
