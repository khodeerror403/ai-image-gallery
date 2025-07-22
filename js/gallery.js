// gallery.js - Handles gallery display and media card rendering

import { formatDuration, getThumbnailPositionStyle, calculateFileSize } from './utils.js';
import { openImageModal } from './modal.js';

let allImages = [];

// Display images and videos in gallery
export function displayImages(items) {
    allImages = items; // Store for other modules to access
    const gallery = document.getElementById('gallery');
    const noImages = document.getElementById('noImages');
    
    gallery.innerHTML = '';
    
    if (items.length === 0) {
        noImages.style.display = 'block';
        noImages.querySelector('p').textContent = 'No media yet. Add some images or videos by dragging and dropping them above!';
        return;
    }
    
    noImages.style.display = 'none';
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.onclick = () => openImageModal(item);
        
        const date = new Date(item.dateAdded).toLocaleDateString();
        const isVideo = item.mediaType === 'video';
        
        // Get file size from base64 data
        const fileSize = calculateFileSize(item.imageData);
        
        // Use thumbnail for display (for videos, this is the generated thumbnail)
        const displayImage = item.thumbnailData || item.imageData;
        
        // Create the card with conditional video controls
        card.innerHTML = `
            <div class="media-container">
                <img src="${displayImage}" alt="${item.title || 'Untitled'}" loading="lazy" style="${getThumbnailPositionStyle(item)}">
                ${isVideo ? `
                    <div class="video-overlay">
                        <button class="play-button" onclick="playVideo(${item.id}, event)" title="Play video">▶️</button>
                        <div class="video-indicator">🎬</div>
                    </div>
                ` : ''}
                <button class="thumbnail-edit-btn" onclick="openThumbnailEditor(${item.id}, event)" title="Edit thumbnail position">✂️</button>
            </div>
            <div class="image-info">
                <div class="image-title">${item.title || 'Untitled'}</div>
                <div class="image-details">
                    <div class="image-detail-line">
                        📅 ${date}
                    </div>
                    <div class="image-detail-line">
                        ${isVideo ? '🎬' : '📐'} <span class="dimensions-placeholder">Loading...</span>
                    </div>
                    <div class="image-detail-line">
                        💾 ${fileSize.display}
                    </div>
                </div>
            </div>
        `;
        
        gallery.appendChild(card);
        
        // Calculate dimensions asynchronously
        if (isVideo && item.metadata && item.metadata.videoWidth) {
            // For videos, use stored metadata
            const dimensions = `${item.metadata.videoWidth} × ${item.metadata.videoHeight}`;
            const duration = item.metadata.duration ? ` (${formatDuration(item.metadata.duration)})` : '';
            const dimensionsSpan = card.querySelector('.dimensions-placeholder');
            if (dimensionsSpan) {
                dimensionsSpan.textContent = dimensions + duration;
            }
        } else {
            // For images or videos without metadata, calculate from image
            const img = new Image();
            img.onload = function() {
                const dimensions = `${this.naturalWidth} × ${this.naturalHeight}`;
                const dimensionsSpan = card.querySelector('.dimensions-placeholder');
                if (dimensionsSpan) {
                    dimensionsSpan.textContent = dimensions;
                }
            };
            img.src = displayImage;
        }
    });
}

// Play video function (called when play button is clicked)
window.playVideo = function(itemId, event) {
    event.stopPropagation(); // Prevent opening modal
    
    // Find the item and open modal in play mode
    const item = allImages.find(i => i.id === itemId);
    if (item) {
        openImageModal(item, true); // true = autoplay
    }
};

// Update stats display
export function updateStats(stats) {
    const { total, images, videos } = stats;
    
    let statsText = `${total} item${total !== 1 ? 's' : ''} stored`;
    
    if (videos > 0) {
        statsText += ` (${images} image${images !== 1 ? 's' : ''}, ${videos} video${videos !== 1 ? 's' : ''})`;
    }
    
    document.getElementById('imageCount').textContent = statsText;
}

// Get all images (for other modules to access)
export function getAllImages() {
    return allImages;
}

// Set all images (for other modules to update)
export function setAllImages(images) {
    allImages = images;
}