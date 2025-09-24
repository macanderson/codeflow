declare module 'react-syntax-highlighter' {
  import * as React from 'react';
  export const Prism: React.ComponentType<any>;
  export const Light: React.ComponentType<any>;
  const Default: any;
  export default Default;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  const styles: Record<string, any>;
  export = styles;
}
