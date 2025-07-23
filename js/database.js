// database.js - Hybrid Storage Implementation
// Version 3.0 - Uses server files + lightweight database

class SQLiteDatabase {
    constructor() {
        this.db = null;
        this.sqlite3 = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            console.log('🚀 Initializing hybrid SQLite database...');
            
            // Load sql.js from CDN
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
            document.head.appendChild(script);
            
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });

            const SQL = await window.initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });

            // Try to load existing database
            let dbData = null;
            try {
                const saved = localStorage.getItem('ai-gallery-hybrid-db');
                if (saved) {
                    dbData = new Uint8Array(JSON.parse(saved));
                }
            } catch (e) {
                console.log('Creating new database');
            }

            this.db = new SQL.Database(dbData);
            this.sqlite3 = SQL;
            
            this.createSchema();
            await this.performMigration();
            
            this.isInitialized = true;
            console.log('✅ Hybrid SQLite database initialized');
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    saveDatabase() {
        try {
            const data = this.db.export();
            localStorage.setItem('ai-gallery-hybrid-db', JSON.stringify(Array.from(data)));
        } catch (error) {
            console.warn('Could not save database:', error);
        }
    }

    createSchema() {
        const schema = `
            CREATE TABLE IF NOT EXISTS media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                prompt TEXT,
                model TEXT,
                tags TEXT,
                notes TEXT,
                date_added TEXT NOT NULL,
                media_type TEXT DEFAULT 'image',
                image_data TEXT,
                thumbnail_data TEXT,
                thumbnail_position_x INTEGER DEFAULT 50,
                thumbnail_position_y INTEGER DEFAULT 25,
                metadata_json TEXT,
                server_path TEXT,
                file_size INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_date_added ON media(date_added DESC);
            CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);
            CREATE INDEX IF NOT EXISTS idx_title ON media(title);
        `;

        this.db.exec(schema);
        this.saveDatabase();
    }

    calculateFileSize(base64Data) {
        try {
            if (!base64Data || typeof base64Data !== 'string') return 0;
            const parts = base64Data.split(',');
            const data = parts.length > 1 ? parts[1] : base64Data;
            return Math.round((data.length * 3) / 4);
        } catch (error) {
            console.warn('Error calculating file size:', error);
            return 0;
        }
    }

    async performMigration() {
        try {
            // Check if we have existing Dexie data
            const dexieExists = await this.checkDexieData();
            if (!dexieExists) {
                console.log('No existing data to migrate');
                return;
            }

            console.log('📦 Found existing data, attempting migration...');
            
            // Load Dexie using script tag method
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/dexie@3.2.4/dist/dexie.js';
            document.head.appendChild(script);
            
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });

            const Dexie = window.Dexie;
            if (!Dexie) {
                throw new Error('Dexie failed to load');
            }
            
            const oldDB = new Dexie('AIImageGallery');
            oldDB.version(3).stores({
                images: '++id, title, prompt, model, tags, notes, dateAdded, imageData, metadata, thumbnailPosition, mediaType, thumbnailData'
            });

            const oldData = await oldDB.images.toArray();
            console.log(`Found ${oldData.length} items to migrate`);
            
            if (oldData.length === 0) {
                console.log('No data to migrate');
                return;
            }
            
            this.db.exec('BEGIN TRANSACTION');
            
            let migratedCount = 0;
            for (const item of oldData) {
                try {
                    const fileSize = this.calculateFileSize(item.imageData);
                    
                    // Store everything in SQLite but with compression for large images
                    let imageData = item.imageData || '';
                    let thumbnailData = item.thumbnailData || item.imageData || '';
                    
                    // If image is too large (>500KB), store server path reference instead
                    if (fileSize > 500000) {
                        // For migration, we'll keep the data but warn about size
                        console.warn(`Large image detected (${Math.round(fileSize/1024)}KB) for item ${item.id}`);
                    }
                    
                    this.db.run(`
                        INSERT INTO media (
                            title, prompt, model, tags, notes, date_added, media_type,
                            image_data, thumbnail_data, thumbnail_position_x, thumbnail_position_y,
                            metadata_json, server_path, file_size
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        item.title || '',
                        item.prompt || '',
                        item.model || '',
                        item.tags || '',
                        item.notes || '',
                        item.dateAdded || new Date().toISOString(),
                        item.mediaType || 'image',
                        imageData,
                        thumbnailData,
                        item.thumbnailPosition?.x || 50,
                        item.thumbnailPosition?.y || 25,
                        item.metadata ? JSON.stringify(item.metadata) : null,
                        item.serverPath || null,
                        fileSize
                    ]);
                    
                    migratedCount++;
                    
                    // Save database periodically to avoid memory buildup
                    if (migratedCount % 10 === 0) {
                        this.db.exec('COMMIT');
                        this.saveDatabase();
                        this.db.exec('BEGIN TRANSACTION');
                        console.log(`Migration progress: ${migratedCount}/${oldData.length}`);
                    }
                    
                } catch (itemError) {
                    console.warn(`Failed to migrate item ${item.id}:`, itemError);
                }
            }

            this.db.exec('COMMIT');
            this.saveDatabase();
            console.log(`✅ Migration completed: ${migratedCount}/${oldData.length} items migrated`);
            
        } catch (error) {
            console.warn('Migration failed, continuing with empty database:', error);
            if (this.db) {
                try {
                    this.db.exec('ROLLBACK');
                } catch (e) {
                    // Ignore rollback errors
                }
            }
        }
    }

    async checkDexieData() {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('AIImageGallery');
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    if (db.objectStoreNames.contains('images')) {
                        const transaction = db.transaction(['images'], 'readonly');
                        const store = transaction.objectStore('images');
                        const countRequest = store.count();
                        countRequest.onsuccess = () => {
                            db.close();
                            resolve(countRequest.result > 0);
                        };
                    } else {
                        db.close();
                        resolve(false);
                    }
                };
                request.onerror = () => resolve(false);
            } catch (error) {
                resolve(false);
            }
        });
    }

    convertSQLiteToExpected(row) {
        const item = { ...row };
        
        // Convert field names back to expected format
        item.dateAdded = row.date_added;
        item.mediaType = row.media_type;
        item.imageData = row.image_data || '';
        item.thumbnailData = row.thumbnail_data || row.image_data || '';
        item.serverPath = row.server_path;
        
        item.thumbnailPosition = {
            x: row.thumbnail_position_x || 50,
            y: row.thumbnail_position_y || 25
        };
        
        if (row.metadata_json) {
            try {
                item.metadata = JSON.parse(row.metadata_json);
            } catch (e) {
                item.metadata = {};
            }
        }
        
        // Clean up internal fields
        delete item.date_added;
        delete item.media_type;
        delete item.image_data;
        delete item.thumbnail_data;
        delete item.server_path;
        delete item.thumbnail_position_x;
        delete item.thumbnail_position_y;
        delete item.metadata_json;
        delete item.created_at;
        delete item.file_size;
        
        return item;
    }

    // API Methods that match original database.js

    getInstance() {
        return {
            images: {
                add: (data) => this.addMedia(data),
                update: (id, data) => this.updateMedia(id, data),
                delete: (id) => this.deleteMedia(id),
                get: (id) => this.getMediaById(id),
                toArray: () => this.loadAllMedia(),
                orderBy: () => ({ reverse: () => ({ toArray: () => this.loadAllMedia() }) })
            }
        };
    }

    async loadAllMedia() {
        if (!this.isInitialized) await this.init();
        
        const stmt = this.db.prepare('SELECT * FROM media ORDER BY created_at DESC');
        
        const results = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(this.convertSQLiteToExpected(row));
        }
        stmt.free();
        
        return results;
    }

    async addMedia(mediaData) {
        if (!this.isInitialized) await this.init();
        
        const fileSize = this.calculateFileSize(mediaData.imageData);
        
        const stmt = this.db.prepare(`
            INSERT INTO media (
                title, prompt, model, tags, notes, date_added, media_type,
                image_data, thumbnail_data, thumbnail_position_x, thumbnail_position_y,
                metadata_json, server_path, file_size
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
            mediaData.title || '',
            mediaData.prompt || '',
            mediaData.model || '',
            mediaData.tags || '',
            mediaData.notes || '',
            mediaData.dateAdded || new Date().toISOString(),
            mediaData.mediaType || 'image',
            mediaData.imageData || '',
            mediaData.thumbnailData || mediaData.imageData || '',
            mediaData.thumbnailPosition?.x || 50,
            mediaData.thumbnailPosition?.y || 25,
            mediaData.metadata ? JSON.stringify(mediaData.metadata) : null,
            mediaData.serverPath || null,
            fileSize
        ]);
        
        stmt.free();
        this.saveDatabase();
        
        const idStmt = this.db.prepare('SELECT last_insert_rowid() as id');
        idStmt.step();
        const result = idStmt.getAsObject();
        idStmt.free();
        
        return result.id;
    }

    async updateMedia(id, updateData) {
        if (!this.isInitialized) await this.init();
        
        const setParts = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updateData)) {
            if (key === 'thumbnailPosition') {
                setParts.push('thumbnail_position_x = ?', 'thumbnail_position_y = ?');
                values.push(value.x || 50, value.y || 25);
            } else if (key === 'metadata') {
                setParts.push('metadata_json = ?');
                values.push(JSON.stringify(value));
            } else if (key === 'dateAdded') {
                setParts.push('date_added = ?');
                values.push(value);
            } else if (key === 'mediaType') {
                setParts.push('media_type = ?');
                values.push(value);
            } else if (key === 'imageData') {
                setParts.push('image_data = ?');
                values.push(value);
                const fileSize = this.calculateFileSize(value);
                setParts.push('file_size = ?');
                values.push(fileSize);
            } else if (key === 'thumbnailData') {
                setParts.push('thumbnail_data = ?');
                values.push(value);
            } else if (key === 'serverPath') {
                setParts.push('server_path = ?');
                values.push(value);
            } else {
                setParts.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (setParts.length === 0) return 0;
        
        values.push(id);
        
        const stmt = this.db.prepare(`UPDATE media SET ${setParts.join(', ')} WHERE id = ?`);
        stmt.run(values);
        stmt.free();
        
        this.saveDatabase();
        return 1;
    }

    async deleteMedia(id) {
        if (!this.isInitialized) await this.init();
        
        const stmt = this.db.prepare('DELETE FROM media WHERE id = ?');
        stmt.run([id]);
        stmt.free();
        
        this.saveDatabase();
        return 1;
    }

    async getMediaById(id) {
        if (!this.isInitialized) await this.init();
        
        const stmt = this.db.prepare('SELECT * FROM media WHERE id = ?');
        stmt.bind([id]);
        
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return this.convertSQLiteToExpected(row);
        }
        
        stmt.free();
        return null;
    }

    async getAllMediaArray() {
        return await this.loadAllMedia();
    }

    async addMultipleMedia(mediaArray) {
        if (!this.isInitialized) await this.init();
        
        const results = [];
        this.db.exec('BEGIN TRANSACTION');
        
        try {
            for (const item of mediaArray) {
                delete item.id;
                const id = await this.addMedia(item);
                results.push({ id, item });
                
                // Save periodically during large imports
                if (results.length % 5 === 0) {
                    this.db.exec('COMMIT');
                    this.saveDatabase();
                    this.db.exec('BEGIN TRANSACTION');
                }
            }
            this.db.exec('COMMIT');
            this.saveDatabase();
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
        
        return results;
    }

    async searchMedia(searchTerm) {
        if (!this.isInitialized) await this.init();
        
        if (!searchTerm || searchTerm.trim() === '') {
            return await this.loadAllMedia();
        }
        
        const term = `%${searchTerm.toLowerCase()}%`;
        const stmt = this.db.prepare(`
            SELECT * FROM media 
            WHERE LOWER(title) LIKE ? 
               OR LOWER(prompt) LIKE ? 
               OR LOWER(tags) LIKE ? 
               OR LOWER(model) LIKE ?
               OR LOWER(notes) LIKE ?
            ORDER BY created_at DESC
        `);
        
        const results = [];
        stmt.bind([term, term, term, term, term]);
        
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(this.convertSQLiteToExpected(row));
        }
        stmt.free();
        
        return results;
    }

    async getStats() {
        if (!this.isInitialized) await this.init();
        
        const stmt = this.db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN media_type = 'image' THEN 1 ELSE 0 END) as images,
                SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END) as videos,
                SUM(file_size) as total_size
            FROM media
        `);
        
        stmt.step();
        const result = stmt.getAsObject();
        stmt.free();
        
        return {
            total: result.total || 0,
            images: result.images || 0,
            videos: result.videos || 0,
            totalSizeMB: Math.round((result.total_size || 0) / (1024 * 1024))
        };
    }

    async exportAllData() {
        const allData = await this.getAllMediaArray();
        return {
            version: '3.0-hybrid',
            exportDate: new Date().toISOString(),
            totalItems: allData.length,
            images: allData
        };
    }

    async close() {
        if (this.db) {
            this.saveDatabase();
            this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
    }
}

// Create singleton instance
const sqliteDB = new SQLiteDatabase();

// Export database API that matches existing interface
export const database = {
    getInstance() {
        return sqliteDB.getInstance();
    },

    async loadAllMedia() {
        return await sqliteDB.loadAllMedia();
    },

    async addMedia(mediaData) {
        return await sqliteDB.addMedia(mediaData);
    },

    async updateMedia(id, updateData) {
        return await sqliteDB.updateMedia(id, updateData);
    },

    async deleteMedia(id) {
        return await sqliteDB.deleteMedia(id);
    },

    async getMediaById(id) {
        return await sqliteDB.getMediaById(id);
    },

    async getAllMediaArray() {
        return await sqliteDB.getAllMediaArray();
    },

    async addMultipleMedia(mediaArray) {
        return await sqliteDB.addMultipleMedia(mediaArray);
    },

    async searchMedia(searchTerm) {
        return await sqliteDB.searchMedia(searchTerm);
    },

    async getStats() {
        return await sqliteDB.getStats();
    },

    async exportAllData() {
        return await sqliteDB.exportAllData();
    },

    async close() {
        return await sqliteDB.close();
    }
};

export default sqliteDB;