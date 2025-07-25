// gallery.js - Handles gallery display and media card rendering

import { formatDuration, getThumbnailPositionStyle, calculateFileSize } from './utils.js';
import { openImageModal } from './modal.js';

let allImages = [];

// Display images and videos in gallery
export function displayImages(items) {
    console.log(`🎨 displayImages called with ${items.length} items`);
    
    // Show standalone images and main gallery images (first image in each gallery)
    const standaloneItems = items.filter(item => {
        // Show standalone images (galleryId = 0 or null)
        if (!item.galleryId || item.galleryId === 0) {
            return true;
        }
        
        // For gallery images, only show the main image (lowest ID in the gallery)
        const galleryImages = items.filter(img => img.galleryId === item.galleryId);
        const mainImage = galleryImages.reduce((min, img) => img.id < min.id ? img : min, galleryImages[0]);
        return item.id === mainImage.id;
    });
    allImages = standaloneItems; // Store for other modules to access
    
    const gallery = document.getElementById('gallery');
    const noImages = document.getElementById('noImages');
    
    gallery.innerHTML = '';
    
    if (standaloneItems.length === 0) {
        console.log('📭 No items to display');
        noImages.style.display = 'block';
        noImages.querySelector('p').textContent = 'No media yet. Add some images or videos by dragging and dropping them above!';
        return;
    }
    
    noImages.style.display = 'none';
    
    standaloneItems.forEach((item, index) => {
        console.log(`🖼️ Rendering item ${index + 1}: ${item.title || 'Untitled'} (${item.mediaType || 'image'})`);
        
        const card = document.createElement('div');
        card.className = 'image-card';
        card.onclick = () => openImageModal(item);
        
        const date = new Date(item.dateAdded).toLocaleDateString();
        const isVideo = item.mediaType === 'video';
        
        // Get file size from item
        const fileSize = {
            display: item.fileSize ? 
                (item.fileSize > 1024 * 1024 ? 
                    `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB` : 
                    `${(item.fileSize / 1024).toFixed(1)} KB`) : 
                'Unknown'
        };
        
        // For videos, use thumbnail data; for images, use server path for full-size display
        const displayImage = item.mediaType === 'video' && item.thumbnailData ? 
            item.thumbnailData : 
            (item.serverPath ? `${item.serverPath}` : '');
        
        console.log(`🎯 Using display image: ${displayImage ? 'Has data' : 'NO DATA'} (length: ${displayImage ? displayImage.length : 0})`);
        
        // Create the card with conditional video controls
        card.innerHTML = `
            <div class="media-container">
                <img src="${displayImage}" alt="${item.title || 'Untitled'}" loading="lazy" style="${getThumbnailPositionStyle(item)}" 
                     onerror="console.error('❌ Image load error for item ${item.id}: ${item.title}'); this.style.display='none';">
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
        console.log(`✅ Card ${index + 1} added to gallery`);
        
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
                console.log(`📐 Dimensions calculated for item ${item.id}: ${dimensions}`);
            };
            img.onerror = function() {
                console.error(`❌ Error calculating dimensions for item ${item.id}: ${item.title}`);
                const dimensionsSpan = card.querySelector('.dimensions-placeholder');
                if (dimensionsSpan) {
                    dimensionsSpan.textContent = 'Unknown';
                }
            };
            img.src = displayImage;
        }
    });
    
    console.log(`🏁 Gallery rendering complete: ${standaloneItems.length} cards displayed`);
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
