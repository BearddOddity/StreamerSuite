export interface StreamerSuiteDocPage {
  /** Zero-padded numeric prefix, e.g. "01". Empty string for undated files. */
  num: string;
  /** Filename without extension, e.g. "01-tauri-v2-architecture". */
  slug: string;
  file: string;
  /** First "# " heading in the file. */
  title: string;
  /** One-line summary from the README index table, if listed there. */
  topic?: string;
}
