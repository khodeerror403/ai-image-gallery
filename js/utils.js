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
    
    // Debug logging
    console.log('cleanPromptText input:', JSON.stringify(text));
    
    // Remove common prefixes/suffixes that might be added by processing
    let cleaned = text.replace(/^(aidma-niji, niji, anime style, sharp image\s*)/i, '');
    
    // Remove other common irrelevant patterns, but be more specific
    cleaned = cleaned.replace(/\b(weight|strength|scale|ratio):\s*[\d.]+(?:,?)/gi, '');
    cleaned = cleaned.replace(/\b(steps|cfg|seed):\s*\d+(?:,?)/gi, '');
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.trim();
    
    // Debug logging
    console.log('cleanPromptText output:', JSON.stringify(cleaned));
    
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
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    const styles = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 5px;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease, fadeOut 0.5s ease 2.5s forwards;
    `;
    
    // Add type-specific styles
    let typeStyles = '';
    switch (type) {
        case 'error':
            typeStyles = 'background-color: #e74c3c;'; // Red for errors
            break;
        case 'success':
            typeStyles = 'background-color: #27ae60;'; // Green for success
            break;
        default:
            typeStyles = 'background-color: #3498db;'; // Blue for info
    }
    
    notification.style.cssText = styles + typeStyles;
    
    // Add animation styles to document head
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes fadeOut {
                from {
                    opacity: 1;
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after animation completes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000); // 3 seconds total (2.5s delay + 0.5s fade out)
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
