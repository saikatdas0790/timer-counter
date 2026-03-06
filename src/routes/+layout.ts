// This is a fully client-side SPA — disable SSR for all routes.
// window / localStorage / IndexedDB are used at the top level in layout and
// page components, which would crash in a Node.js SSR context.
export const ssr = false;
