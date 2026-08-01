/** Déclarations pour les imports d'assets gérés par le bundler de Next. */

declare module '*.css';

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
