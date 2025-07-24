import Database from 'better-sqlite3';

const db = new Database('gallery.db');

console.log('Checking for videos in database...');
const videos = db.prepare("SELECT id, title, media_type, server_path FROM media WHERE media_type = 'video'").all();
console.log(`Found ${videos.length} videos:`);
console.log(videos);

// Check if any videos have thumbnail data
if (videos.length > 0) {
  const videoWithThumbnail = db.prepare("SELECT id, title, length(thumbnail_data) as thumbnail_length FROM media WHERE media_type = 'video' AND thumbnail_data IS NOT NULL").get();
  if (videoWithThumbnail) {
    console.log(`Video with thumbnail data: ID ${videoWithThumbnail.id}, Title: ${videoWithThumbnail.title}, Thumbnail length: ${videoWithThumbnail.thumbnail_length}`);
  } else {
    console.log('No videos with thumbnail data found');
  }
}

db.close();
