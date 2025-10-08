import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const OAuth2 = google.auth.OAuth2;

interface VideoMetadata {
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
}

export async function uploadToYouTube(
  videoPath: string,
  metadata: VideoMetadata,
  credentials: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
  }
) {
  const oauth2Client = new OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: credentials.refreshToken,
  });

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });

  const fileSize = fs.statSync(videoPath).size;

  console.log(`Uploading ${path.basename(videoPath)} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags || [],
        categoryId: metadata.categoryId || '22', // Default: People & Blogs
      },
      status: {
        privacyStatus: metadata.privacyStatus,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = response.data.id;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  console.log(`Upload complete! Video ID: ${videoId}`);
  console.log(`Video URL: ${videoUrl}`);

  return {
    videoId,
    videoUrl,
    response: response.data,
  };
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const videoPath = process.argv[2];
  const title = process.argv[3] || 'Untitled Video';
  const description = process.argv[4] || '';
  const privacyStatus = (process.argv[5] || 'private') as 'public' | 'private' | 'unlisted';

  if (!videoPath) {
    console.error('Usage: npx tsx src/youtube.ts <video-path> [title] [description] [privacyStatus]');
    process.exit(1);
  }

  if (!fs.existsSync(videoPath)) {
    console.error(`File not found: ${videoPath}`);
    process.exit(1);
  }

  const credentials = {
    clientId: process.env.YOUTUBE_CLIENT_ID!,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth2callback',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN!,
  };

  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
    console.error('Missing YouTube OAuth credentials in environment variables:');
    console.error('- YOUTUBE_CLIENT_ID');
    console.error('- YOUTUBE_CLIENT_SECRET');
    console.error('- YOUTUBE_REFRESH_TOKEN');
    console.error('- YOUTUBE_REDIRECT_URI (optional)');
    process.exit(1);
  }

  uploadToYouTube(videoPath, {
    title,
    description,
    privacyStatus,
  }, credentials)
    .then(result => {
      console.log('Success:', result);
    })
    .catch(error => {
      console.error('Upload failed:', error.message);
      process.exit(1);
    });
}
