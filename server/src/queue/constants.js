export const RENDER_QUEUE = 'render';

// BullMQ job ids cannot contain ':'
export const jobIdFor = (projectId) => `render-${projectId}`;