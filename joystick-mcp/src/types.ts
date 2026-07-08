export interface JoystickDocPage {
  title: string;
  slug: string;
  section: string;
  /** Anchor on the source page this content comes from. */
  url: string;
  /** Markdown heading text used to slice this page's body out of the source file. */
  heading: string;
}
