// utils.js - Utility functions used across the application

// Format duration from seconds to MM:SS
export function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Get thumbnail position CSS style
export function getThumbnailPositionStyle(item) {
    if (item.thumbnailPosition) {
        return `object-position: ${item.thumbnailPosition.x}% ${item.thumbnailPosition.y}%;`;
    }
    return 'object-position: 50% 25%;'; // TOP-ALIGNED default: 25% from top instead of center
}

// Generate safe filename for downloads
export function generateSafeFilename(title, suffix = '') {
    const safeTitle = (title || 'Untitled').replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    return `${safeTitle}${suffix ? '_' + suffix : ''}_${timestamp}`;
}

// Calculate file size from base64 data
export function calculateFileSize(base64Data) {
    const data = base64Data.split(',')[1];
    const fileSizeBytes = Math.round((data.length * 3) / 4);
    const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);
    const fileSizeKB = (fileSizeBytes / 1024).toFixed(1);
    return {
        bytes: fileSizeBytes,
        display: fileSizeBytes > 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`,
        mb: fileSizeMB,
        kb: fileSizeKB
    };
}

// Clean up text content for display
export function cleanPromptText(text) {
    if (!text) return '';
    
    // Remove common prefixes/suffixes that might be added by processing
    let cleaned = text.replace(/^(aidma-niji, niji, anime style, sharp image\s*)/i, '');
    cleaned = cleaned.replace(/\n+/g, ' '); // Replace newlines with spaces
    cleaned = cleaned.trim();
    
    return cleaned;
}

// Clean model names for display
export function cleanModelName(modelName) {
    if (!modelName) return '';
    
    // Remove file extensions
    let cleaned = modelName.replace(/\.(safetensors|ckpt|pt)$/i, '');
    
    // Remove common prefixes/paths
    cleaned = cleaned.replace(/^.*[\/\\]/, ''); // Remove path
    cleaned = cleaned.replace(/^SDXL[\/\\]?/i, ''); // Remove SDXL prefix
    
    // Clean up underscores and make more readable
    cleaned = cleaned.replace(/_/g, ' ');
    
    return cleaned.trim();
}

// Debounce function for search input
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Download blob as file
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Show user notification
export function showNotification(message, type = 'info') {
    // For now, use alert - could be enhanced with toast notifications later
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        alert('💡 ' + message);
    }
}

// Validate file type
export function isValidMediaFile(file) {
    return file.type.startsWith('image/') || file.type.startsWith('video/');
}

// Get media type from file
export function getMediaType(file) {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    return 'unknown';
}