import type { Handle } from "@sveltejs/kit";

const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event, {
    ssr: false,
  });

  return response;
};

export { handle };
