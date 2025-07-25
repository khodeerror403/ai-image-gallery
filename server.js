import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const app = express();
const port = 3015;
const db = new Database('gallery.db');

// --- Utility Functions ---
function toCamelCase(s) {
    return s.replace(/([-_][a-z])/ig, ($1) => {
        return $1.toUpperCase().replace('-', '').replace('_', '');
    });
}

function transformMediaRow(row) {
    const newRow = {};
    for (const key in row) newRow[toCamelCase(key)] = row[key];
    
    // Special handling for thumbnail position
    if (row.thumbnail_position_x !== undefined && row.thumbnail_position_y !== undefined) {
        newRow.thumbnailPosition = {
            x: row.thumbnail_position_x,
            y: row.thumbnail_position_y
        };
        // Remove the individual position properties
        delete newRow.thumbnailPositionX;
        delete newRow.thumbnailPositionY;
    }
    
    // Special handling for metadata JSON
    if (row.metadata_json) {
        try {
            newRow.metadata = JSON.parse(row.metadata_json);
            delete newRow.metadataJson;
        } catch (e) {
            // If parsing fails, keep the raw string
            newRow.metadata = row.metadata_json;
            delete newRow.metadataJson;
        }
    }
    
    return newRow;
}

// Middleware
app.use(express.json({ limit: '50mb' })); // For handling large base64 thumbnails
app.use(express.static('.')); // Serve static files from the root directory

// --- Database Schema Setup ---
function setupDatabase() {
    // Check if gallery_id column exists, add it if not
    const tableInfo = db.prepare("PRAGMA table_info(media)").all();
    const hasGalleryId = tableInfo.some(col => col.name === 'gallery_id');
    
    let schema = `
        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            prompt TEXT,
            model TEXT,
            tags TEXT,
            notes TEXT,
            date_added TEXT NOT NULL,
            media_type TEXT DEFAULT 'image',
            thumbnail_data TEXT,
            thumbnail_position_x INTEGER DEFAULT 50,
            thumbnail_position_y INTEGER DEFAULT 25,
            metadata_json TEXT,
            server_path TEXT UNIQUE,
            file_size INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    if (!hasGalleryId) {
        schema += `
            ALTER TABLE media ADD COLUMN gallery_id INTEGER DEFAULT 0;
        `;
    }
    
    schema += `
        CREATE INDEX IF NOT EXISTS idx_server_path ON media(server_path);
    `;
    db.exec(schema);
    console.log('✅ Database schema is ready.');
}

// --- File Upload Configuration (Multer) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = file.mimetype.startsWith('video') ? 'videos' : 'images';
        const date = new Date().toISOString().slice(0, 10);
        const dest = path.join(dir, date);
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniquePrefix = Date.now();
        const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
        cb(null, `${uniquePrefix}_${safeOriginalName}`);
    }
});
const upload = multer({ storage });

// --- API Endpoints ---

// POST /upload - Handles file uploads
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }
    const relativePath = path.join(req.file.destination, req.file.filename).replace(/\\/g, '/');
    res.json({
        success: true,
        message: 'File uploaded successfully',
        filename: req.file.filename,
        path: req.file.path,
        relativePath: relativePath,
        size: req.file.size
    });
});

// GET /api/media - Get all media items
app.get('/api/media', (req, res) => {
    try {
        const { q: searchTerm } = req.query;
        let rows;

        if (searchTerm) {
            const term = `%${searchTerm.toLowerCase()}%`;
            const stmt = db.prepare(`
                SELECT * FROM media 
                WHERE LOWER(title) LIKE @term 
                   OR LOWER(prompt) LIKE @term 
                   OR LOWER(tags) LIKE @term 
                ORDER BY created_at DESC
            `);
            rows = stmt.all({ term });
        } else {
            const stmt = db.prepare('SELECT * FROM media ORDER BY created_at DESC');
            rows = stmt.all();
        }

        const media = rows.map(row => transformMediaRow(row));

        res.json(media);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch media.' });
    }
});

// GET /api/media/:id - Get single media item
app.get('/api/media/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('SELECT * FROM media WHERE id = ?');
        const row = stmt.get(id);
        
        if (!row) {
            return res.status(404).json({ error: 'Media not found.' });
        }
        
        const media = transformMediaRow(row);
        res.json(media);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch media.' });
    }
});

// GET /api/media/gallery/:galleryId - Get media items by gallery ID
app.get('/api/media/gallery/:galleryId', (req, res) => {
    try {
        const { galleryId } = req.params;
        const stmt = db.prepare('SELECT * FROM media WHERE gallery_id = ? ORDER BY created_at DESC');
        const rows = stmt.all(galleryId);
        
        const media = rows.map(row => transformMediaRow(row));
        res.json(media);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch media.' });
    }
});

// POST /api/media - Add new media metadata
app.post('/api/media', (req, res) => {
    try {
        const { title, prompt, model, tags, notes, dateAdded, mediaType, thumbnailData, thumbnailPosition, metadata, serverPath, fileSize, galleryId } = req.body;
        
        // Handle thumbnailPosition - provide defaults if not present
        const thumbX = thumbnailPosition && typeof thumbnailPosition.x !== 'undefined' ? thumbnailPosition.x : 50;
        const thumbY = thumbnailPosition && typeof thumbnailPosition.y !== 'undefined' ? thumbnailPosition.y : 25;
        
        // Handle dateAdded - provide default if not present
        const dateAddedValue = dateAdded || new Date().toISOString();
        
        // Handle galleryId - provide default if not present
        const galleryIdValue = typeof galleryId !== 'undefined' ? galleryId : 0;
        
        const stmt = db.prepare(`
            INSERT INTO media (title, prompt, model, tags, notes, date_added, media_type, thumbnail_data, thumbnail_position_x, thumbnail_position_y, metadata_json, server_path, file_size, gallery_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(title, prompt, model, tags, notes, dateAddedValue, mediaType, thumbnailData, thumbX, thumbY, JSON.stringify(metadata), serverPath, fileSize, galleryIdValue);
        
        const newMedia = db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid);
        res.status(201).json(newMedia);
    } catch (error) {
        console.error('DB Insert Error:', error);
        res.status(500).json({ error: 'Failed to save media metadata.' });
    }
});

// PUT /api/media/:id - Update media item
app.put('/api/media/:id', (req, res) => {
    try {
        const { id } = req.params;
        const fields = req.body;
        
        const setClauses = [];
        const values = [];

        for (const [key, value] of Object.entries(fields)) {
            if (key === 'id') continue;
            if (key === 'thumbnailPosition') {
                setClauses.push('thumbnail_position_x = ?', 'thumbnail_position_y = ?');
                values.push(value.x, value.y);
            } else {
                // Convert camelCase to snake_case for DB columns
                const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                setClauses.push(`${dbKey} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'No fields to update.' });
        }

        values.push(id);
        const stmt = db.prepare(`UPDATE media SET ${setClauses.join(', ')} WHERE id = ?`);
        stmt.run(values);

        const updatedMedia = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
        res.json(updatedMedia);
    } catch (error) {
        console.error('DB Update Error:', error);
        res.status(500).json({ error: 'Failed to update media.' });
    }
});

// DELETE /api/media/:id - Delete media item
app.delete('/api/media/:id', (req, res) => {
    try {
        const { id } = req.params;
        const media = db.prepare('SELECT server_path FROM media WHERE id = ?').get(id);

        if (media && media.server_path) {
            // Delete the physical file
            fs.unlink(media.server_path, (err) => {
                if (err) console.error(`Failed to delete file: ${media.server_path}`, err);
                else console.log(`Deleted file: ${media.server_path}`);
            });
        }

        const stmt = db.prepare('DELETE FROM media WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes > 0) {
            res.status(200).json({ success: true, message: 'Media deleted.' });
        } else {
            res.status(404).json({ error: 'Media not found.' });
        }
    } catch (error) {
        console.error('DB Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete media.' });
    }
});

// GET /api/stats - Get gallery statistics
app.get('/api/stats', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN media_type = 'image' THEN 1 ELSE 0 END) as images,
                SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END) as videos,
                SUM(file_size) as total_size
            FROM media
        `);
        const stats = stmt.get();
        res.json({
            total: stats.total || 0,
            images: stats.images || 0,
            videos: stats.videos || 0,
            totalSizeMB: Math.round((stats.total_size || 0) / (1024 * 1024))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats.' });
    }
});

// GET /api/export - Export all data as JSON
app.get('/api/export', (req, res) => {
    try {
        const allData = db.prepare('SELECT * FROM media').all();
        const exportData = {
            version: '4.0-server',
            exportDate: new Date().toISOString(),
            media: allData
        };
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export data.' });
    }
});

// POST /api/clear-all - Clear all data (database and files)
app.post('/api/clear-all', (req, res) => {
    try {
        console.log('Starting clear all data operation...');
        
        // Get all media items to delete their files
        const allMedia = db.prepare('SELECT server_path FROM media').all();
        console.log(`Found ${allMedia.length} media items to process`);
        
        // Delete all physical files
        let fileDeleteCount = 0;
        let fileDeleteErrors = 0;
        
        for (const media of allMedia) {
            if (media.server_path) {
                try {
                    // Check if file exists before trying to delete
                    if (fs.existsSync(media.server_path)) {
                        fs.unlinkSync(media.server_path);
                        console.log(`Deleted file: ${media.server_path}`);
                        fileDeleteCount++;
                        
                        // Try to remove empty directories
                        try {
                            const dir = path.dirname(media.server_path);
                            if (fs.readdirSync(dir).length === 0) {
                                fs.rmdirSync(dir);
                                console.log(`Removed empty directory: ${dir}`);
                            }
                        } catch (dirError) {
                            // Ignore directory removal errors
                            console.log(`Could not remove directory (might not be empty): ${path.dirname(media.server_path)}`);
                        }
                    } else {
                        console.log(`File not found (skipping): ${media.server_path}`);
                    }
                } catch (fileError) {
                    console.error(`Failed to delete file: ${media.server_path}`, fileError);
                    fileDeleteErrors++;
                }
            }
        }
        
        // Clear the database
        const stmt = db.prepare('DELETE FROM media');
        const info = stmt.run();
        console.log(`Cleared database: ${info.changes} records deleted`);
        
        // Reset auto-increment counter
        try {
            db.prepare('DELETE FROM sqlite_sequence WHERE name = "media"').run();
            console.log('Reset auto-increment counter');
        } catch (resetError) {
            console.log('Could not reset auto-increment counter (may not exist)', resetError);
        }
        
        res.json({
            success: true,
            message: 'All data cleared successfully',
            filesDeleted: fileDeleteCount,
            fileErrors: fileDeleteErrors,
            databaseRecordsDeleted: info.changes
        });
    } catch (error) {
        console.error('Clear all data error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to clear all data: ' + error.message 
        });
    }
});

// --- Serve the main HTML file ---
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

// --- Start Server ---
app.listen(port, () => {
    setupDatabase();
    console.log(`🚀 Server running at http://localhost:${port}`);
});
