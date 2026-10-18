// Tells TypeScript that importing image files gives you a string (the URL path).
// Without this, TypeScript throws "Cannot find module './images/foo.png'".
// The actual file handling is done by esbuild (see loader config in build.helpers.mjs).
declare module "*.png" {
    const src: string;
    export default src;
}

declare module "*.svg" {
    const src: string;
    export default src;
}

declare module "*.gif" {
    const src: string;
    export default src;
}
