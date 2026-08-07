interface NodeRequire {
  context(
    directory: string,
    useSubdirectories?: boolean,
    regExp?: RegExp
  ): {
    (key: string): number;
    keys(): string[];
  };
}
