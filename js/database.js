// database.js - Server API Client
// Version 5.0 - Pure server API implementation

/**
 * Make API request to server
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {Object} body - Request body
 * @returns {Promise} API response
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
    }
    
    return await response.json();
}

// API Methods that match original database.js interface

export const database = {
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
    },

    async loadAllMedia() {
        return await apiRequest('/api/media');
    },

    async addMedia(mediaData) {
        // Remove base64 data before sending to server to save bandwidth, but keep thumbnailData for videos
        const serverMediaData = { ...mediaData };
        delete serverMediaData.imageData;
        // Don't delete thumbnailData as it's needed for video thumbnails
        
        const result = await apiRequest('/api/media', 'POST', serverMediaData);
        return result.id;
    },

    async updateMedia(id, updateData) {
        // Remove base64 data before sending to server to save bandwidth, but keep thumbnailData for videos
        const serverUpdateData = { ...updateData };
        delete serverUpdateData.imageData;
        // Don't delete thumbnailData as it's needed for video thumbnails
        
        const result = await apiRequest(`/api/media/${id}`, 'PUT', serverUpdateData);
        return result.id;
    },

    async deleteMedia(id) {
        await apiRequest(`/api/media/${id}`, 'DELETE');
        return 1;
    },

    async getMediaById(id) {
        const media = await apiRequest(`/api/media`);
        return media.find(item => item.id == id) || null;
    },

    async getAllMediaArray() {
        return await this.loadAllMedia();
    },

    async addMultipleMedia(mediaArray) {
        const results = [];
        for (const item of mediaArray) {
            try {
                const id = await this.addMedia(item);
                results.push({ id, item });
            } catch (error) {
                console.error('Error adding media:', error);
                results.push({ error: error.message, item });
            }
        }
        return results;
    },

    async searchMedia(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return await this.loadAllMedia();
        }
        return await apiRequest(`/api/media?q=${encodeURIComponent(searchTerm)}`);
    },

    async getStats() {
        return await apiRequest('/api/stats');
    },

    async exportAllData() {
        const exportData = await apiRequest('/api/export');
        return {
            version: '5.0-server',
            exportDate: new Date().toISOString(),
            totalItems: exportData.media ? exportData.media.length : 0,
            images: exportData.media || []
        };
    }
};

export default database;
