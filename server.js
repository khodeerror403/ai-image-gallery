const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3015;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Configure multer for file uploads with date-based organization and media type separation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine if this is a video or image file
    const isVideo = file.mimetype.startsWith('video/');
    const mediaFolder = isVideo ? 'videos' : 'images';
    
    // Create date-based folder (YYYY-MM-DD) using server's local timezone
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
    const dateFolder = localDate; // This will be in YYYY-MM-DD format
    
    console.log(`📅 Creating folder for local date: ${dateFolder}`);
    console.log(`📅 Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    
    const uploadPath = path.join(__dirname, mediaFolder, dateFolder);
    
    // Create directory if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true });
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Use timestamp + original filename to avoid conflicts
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${sanitizedName}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit (increased for videos)
  },
  fileFilter: function (req, file, cb) {
    // Allow both image and video files
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle single file upload (supports both images and videos)
app.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: req.file.path,
      relativePath: path.relative(__dirname, req.file.path),
      uploadDate: new Date().toISOString(),
      mediaType: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
    };

    const mediaType = fileInfo.mediaType === 'video' ? 'Video' : 'Image';
    const folder = fileInfo.mediaType === 'video' ? 'videos' : 'images';
    console.log(`📁 ${mediaType} saved: ${fileInfo.relativePath} (in ${folder}/ directory)`);
    res.json(fileInfo);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Handle multiple file uploads (supports both images and videos)
app.post('/upload-multiple', upload.array('images', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const filesInfo = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      relativePath: path.relative(__dirname, file.path),
      uploadDate: new Date().toISOString(),
      mediaType: file.mimetype.startsWith('video/') ? 'video' : 'image'
    }));

    const imageCount = filesInfo.filter(f => f.mediaType === 'image').length;
    const videoCount = filesInfo.filter(f => f.mediaType === 'video').length;
    
    console.log(`📁 ${filesInfo.length} files saved to organized directories:`);
    if (imageCount > 0) console.log(`  📷 ${imageCount} images → images/ directory`);
    if (videoCount > 0) console.log(`  🎬 ${videoCount} videos → videos/ directory`);
    
    res.json({ success: true, files: filesInfo });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// DELETE endpoint for removing files from server
app.delete('/delete/:relativePath(*)', (req, res) => {
  try {
    const relativePath = req.params.relativePath;
    const fullPath = path.join(__dirname, relativePath);
    
    // Security check: ensure the path is within our project directory
    const resolvedPath = path.resolve(fullPath);
    const projectRoot = path.resolve(__dirname);
    
    if (!resolvedPath.startsWith(projectRoot)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete the file
    fs.unlinkSync(resolvedPath);
    
    console.log(`🗑️ Deleted file: ${relativePath}`);
    res.json({ success: true, message: 'File deleted successfully', path: relativePath });
    
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed: ' + error.message });
  }
});

// Get list of uploaded media organized by date (searches both images/ and videos/ directories)
app.get('/api/images', (req, res) => {
  try {
    const imagesDir = path.join(__dirname, 'images');
    const videosDir = path.join(__dirname, 'videos');
    
    const mediaByDate = {};
    let totalImages = 0;
    let totalVideos = 0;
    const allDates = new Set();

    // Helper function to process a directory (images or videos)
    function processDirectory(baseDir, mediaType) {
      if (!fs.existsSync(baseDir)) {
        return;
      }

      const dateDirectories = fs.readdirSync(baseDir)
        .filter(item => fs.statSync(path.join(baseDir, item)).isDirectory())
        .sort();

      dateDirectories.forEach(dateDir => {
        allDates.add(dateDir);
        
        if (!mediaByDate[dateDir]) {
          mediaByDate[dateDir] = [];
        }

        const datePath = path.join(baseDir, dateDir);
        const fileExtensions = mediaType === 'image' 
          ? /\.(jpg|jpeg|png|gif|webp)$/i 
          : /\.(mp4|mov|avi|mkv)$/i;

        const files = fs.readdirSync(datePath)
          .filter(file => fileExtensions.test(file))
          .map(file => {
            const stats = fs.statSync(path.join(datePath, file));
            const folderName = mediaType === 'image' ? 'images' : 'videos';
            
            if (mediaType === 'image') {
              totalImages++;
            } else {
              totalVideos++;
            }
            
            return {
              filename: file,
              path: `/${folderName}/${dateDir}/${file}`,
              size: stats.size,
              modified: stats.mtime,
              mediaType: mediaType
            };
          });
        
        mediaByDate[dateDir].push(...files);
      });
    }

    // Process both images and videos directories
    processDirectory(imagesDir, 'image');
    processDirectory(videosDir, 'video');

    // Sort dates in reverse order (most recent first)
    const sortedDates = Array.from(allDates).sort().reverse();

    // Remove empty date entries and sort files within each date
    sortedDates.forEach(date => {
      if (mediaByDate[date] && mediaByDate[date].length === 0) {
        delete mediaByDate[date];
      } else if (mediaByDate[date]) {
        // Sort files within each date by modification time (newest first)
        mediaByDate[date].sort((a, b) => new Date(b.modified) - new Date(a.modified));
      }
    });

    res.json({
      success: true,
      dates: Object.keys(mediaByDate),
      mediaByDate: mediaByDate,
      totalImages: totalImages,
      totalVideos: totalVideos,
      totalFiles: totalImages + totalVideos
    });
  } catch (error) {
    console.error('Error listing media:', error);
    res.status(500).json({ error: 'Failed to list media files' });
  }
});

// Serve uploaded images statically
app.use('/images', express.static(path.join(__dirname, 'images')));

// Serve uploaded videos statically
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 100MB)' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Media Gallery server running on port ${PORT}`);
  console.log(`📁 Media organization:`);
  console.log(`  📷 Images: ./images/YYYY-MM-DD/`);
  console.log(`  🎬 Videos: ./videos/YYYY-MM-DD/`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser`);
  console.log(`📷 Supports: Images (PNG, JPG, GIF, WebP)`);
  console.log(`🎬 Supports: Videos (MP4, MOV, AVI, MKV)`);
  
  // Create both media directories if they don't exist
  const imagesDir = path.join(__dirname, 'images');
  const videosDir = path.join(__dirname, 'videos');
  
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`📁 Created images directory: ${imagesDir}`);
  }
  
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
    console.log(`📁 Created videos directory: ${videosDir}`);
  }
});