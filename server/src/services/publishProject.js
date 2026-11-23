import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { InstagramAccount } from '../models/InstagramAccount.js';
import { logger } from '../config/logger.js';
import { decrypt } from './crypto.js';
import {
  buildCaption, createReelContainer, waitUntilFinished, publishContainer, getPermalink, getPublishingLimit,
} from './publisher.js';

const MAX_REEL_SECONDS = 90;
const permanent = (message) => Object.assign(new Error(message), { permanent: true });

export async function publishProject(
  projectId,
  { userId, expectedVideoUrl, shouldRetry = () => false, onProgress = () => {} } = {}
) {
  if (!mongoose.isValidObjectId(projectId)) throw permanent('Project not found');
  const project = await Project.findOne({ _id: projectId, user: userId });
  if (!project) throw permanent('Project not found');

  // A retried job must never post the same video twice
  if (project.igMediaId && project.publishedVideoUrl === project.videoUrl) {
    return { mediaId: project.igMediaId, permalink: project.igPermalink, alreadyPublished: true };
  }

  // A scheduled post must never publish a video other than the one that was scheduled
  if (expectedVideoUrl && project.videoUrl !== expectedVideoUrl) {
    throw permanent('The video changed after this post was scheduled, please schedule it again');
  }

  if (project.status !== 'rendered' || !project.videoUrl) throw permanent('Render the video first');
  if (!project.videoUrl.startsWith('https://')) throw permanent('The video needs a public HTTPS link');
  if (project.videoDurationSec > MAX_REEL_SECONDS) {
    throw permanent(`Reels published through the API can be at most ${MAX_REEL_SECONDS} seconds`);
  }

  const account = await InstagramAccount.findOne({ user: userId }).select('+accessTokenEnc');
  if (!account) throw permanent('Instagram is not connected');

  await Project.updateOne(
    { _id: project._id },
    { $set: { publishState: 'publishing' }, $unset: { publishError: 1, scheduledFor: 1 } }
  );

  try {
    const token = decrypt(account.accessTokenEnc);
    const igUserId = account.igUserId;

    const limit = await getPublishingLimit({ igUserId, token });
    if (limit && limit.used >= limit.total) {
      throw permanent('The Instagram publishing limit for the last 24 hours has been reached');
    }

    onProgress({ stage: 'creating', percent: 15 });
    const container = await createReelContainer({
      igUserId, token, videoUrl: project.videoUrl, caption: buildCaption(project.script),
    });

    onProgress({ stage: 'processing', percent: 40 });
    await waitUntilFinished({ containerId: container.id, token });

    onProgress({ stage: 'publishing', percent: 85 });
    const published = await publishContainer({ igUserId, token, containerId: container.id });

    await Project.updateOne(
      { _id: project._id },
      {
        $set: {
          igMediaId: published.id,
          igPermalink: null,
          publishedVideoUrl: project.videoUrl,
          publishedAt: new Date(),
          publishState: 'published',
        },
        $unset: { publishError: 1 },
      }
    );

    // The permalink is a nice extra: failing to fetch it must not fail the publish
    let permalink = null;
    try {
      permalink = await getPermalink({ mediaId: published.id, token });
      if (permalink) await Project.updateOne({ _id: project._id }, { $set: { igPermalink: permalink } });
    } catch (err) {
      logger.warn({ err: err.message }, 'Could not fetch the Instagram permalink');
    }

    onProgress({ stage: 'done', percent: 100 });
    return { mediaId: published.id, permalink };
  } catch (err) {
    const retrying = shouldRetry(err);
    logger.error({ err: err.message, retrying }, 'Publish attempt failed');
    await Project.updateOne(
      { _id: project._id },
      { $set: { publishState: retrying ? 'queued' : 'failed', publishError: String(err.message).slice(0, 500) } }
    );
    throw err;
  }
}