// database.js - Handles all IndexedDB operations using Dexie

// Initialize Dexie database with updated schema for media support
const db = new Dexie('AIImageGallery');
db.version(3).stores({
    images: '++id, title, prompt, model, tags, notes, dateAdded, imageData, metadata, thumbnailPosition, mediaType, thumbnailData'
}).upgrade(tx => {
    // Add new fields to existing records with TOP-ALIGNED default
    return tx.images.toCollection().modify(item => {
        if (!item.thumbnailPosition) {
            item.thumbnailPosition = { x: 50, y: 25 }; // TOP-ALIGNED: 25% from top instead of 50% center
        }
        if (!item.mediaType) {
            item.mediaType = 'image'; // Default to image for existing records
        }
        if (!item.thumbnailData) {
            item.thumbnailData = item.imageData; // Use main data as thumbnail for images
        }
    });
});

// Database operation functions
export const database = {
    // Get the database instance
    getInstance() {
        return db;
    },

    // Load all media items from database
    async loadAllMedia() {
        return await db.images.orderBy('dateAdded').reverse().toArray();
    },

    // Add a new media item to database
    async addMedia(mediaData) {
        return await db.images.add(mediaData);
    },

    // Update an existing media item
    async updateMedia(id, updateData) {
        return await db.images.update(id, updateData);
    },

    // Delete a media item
    async deleteMedia(id) {
        return await db.images.delete(id);
    },

    // Get a specific media item by ID
    async getMediaById(id) {
        return await db.images.get(id);
    },

    // Get all media items as array (for export)
    async getAllMediaArray() {
        return await db.images.toArray();
    },

    // Add multiple media items (for import)
    async addMultipleMedia(mediaArray) {
        const results = [];
        for (const item of mediaArray) {
            // Remove ID to avoid conflicts
            delete item.id;
            
            // Ensure mediaType exists (backward compatibility)
            if (!item.mediaType) {
                item.mediaType = 'image';
            }
            
            // Ensure thumbnailData exists
            if (!item.thumbnailData) {
                item.thumbnailData = item.imageData;
            }

            // Ensure thumbnailPosition uses TOP-ALIGNED default
            if (!item.thumbnailPosition) {
                item.thumbnailPosition = { x: 50, y: 25 }; // TOP-ALIGNED default
            }
            
            const id = await db.images.add(item);
            results.push({ id, item });
        }
        return results;
    },

    // Search media items
    async searchMedia(searchTerm) {
        if (!searchTerm) {
            return await this.loadAllMedia();
        }
        
        const allMedia = await this.loadAllMedia();
        const term = searchTerm.toLowerCase();
        
        return allMedia.filter(item => 
            (item.title || '').toLowerCase().includes(term) ||
            (item.prompt || '').toLowerCase().includes(term) ||
            (item.tags || '').toLowerCase().includes(term) ||
            (item.model || '').toLowerCase().includes(term)
        );
    },

    // Get statistics
    async getStats() {
        const allMedia = await this.loadAllMedia();
        const totalCount = allMedia.length;
        const imageCount = allMedia.filter(item => item.mediaType !== 'video').length;
        const videoCount = allMedia.filter(item => item.mediaType === 'video').length;
        
        return {
            total: totalCount,
            images: imageCount,
            videos: videoCount
        };
    },

    // Export all data with metadata
    async exportAllData() {
        const allData = await this.getAllMediaArray();
        return {
            version: '2.1', // Updated version with modular structure and top-aligned defaults
            exportDate: new Date().toISOString(),
            totalItems: allData.length,
            images: allData // Keep same field name for backward compatibility
        };
    }
};

export default db;