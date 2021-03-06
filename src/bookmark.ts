/**
 * Public class that represents a single bookmark item.
 */
export class Bookmark {
  public title: string;
  public basePath: string;
  public absPath: string;
  public activePath: string;
  public disabled: boolean;
  public category: string;

  constructor(
    title: string,
    basPath: string,
    absPath: string,
    activePath: string,
    disabled: boolean,
    category: string
  ) {
    this.title = title;
    this.basePath = basPath;
    this.absPath = absPath;
    this.activePath = activePath;
    this.disabled = disabled;
    this.category = category;
  }

  public equals(that: Bookmark): boolean {
    if (
      this.absPath === that.absPath &&
      this.activePath === that.activePath &&
      this.basePath === that.basePath &&
      this.category === that.category &&
      this.disabled === that.disabled &&
      this.title === that.title
    ) {
      return true;
    } else {
      return false;
    }
  }
}
