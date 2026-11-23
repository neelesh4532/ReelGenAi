export const RENDER_QUEUE = 'render';

// BullMQ job ids cannot contain ':'
export const jobIdFor = (projectId) => `render-${projectId}`;

export const PUBLISH_QUEUE = 'publish';
export const publishJobIdFor = (projectId) => `publish-${projectId}`;