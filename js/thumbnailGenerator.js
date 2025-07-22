// thumbnailGenerator.js - Version 2.1
// Advanced utilities for generating high-quality thumbnails with modular integration

import { database } from './database.js';
import { showNotification } from './utils.js';

/**
 * Generate a high-quality thumbnail from an image
 * @param {string} imageDataUrl - The original image as a data URL
 * @param {number} targetWidth - Target width for thumbnail
 * @param {number} targetHeight - Target height for thumbnail
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<string>} - Thumbnail as data URL
 */
export async function generateThumbnail(imageDataUrl, targetWidth = 600, targetHeight = 400, quality = 0.92) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate dimensions to maintain aspect ratio
            const aspectRatio = img.width / img.height;
            const targetAspectRatio = targetWidth / targetHeight;
            
            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
            
            if (aspectRatio > targetAspectRatio) {
                // Image is wider than target
                drawHeight = targetHeight;
                drawWidth = drawHeight * aspectRatio;
                offsetX = -(drawWidth - targetWidth) / 2;
            } else {
                // Image is taller than target
                drawWidth = targetWidth;
                drawHeight = drawWidth / aspectRatio;
                offsetY = -(drawHeight - targetHeight) / 2;
            }
            
            // Set canvas size to target dimensions
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            // Enable image smoothing for better quality
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Fill with a subtle background color (in case of transparency)
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            
            // Draw the image
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            
            // Convert to data URL with specified quality
            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(thumbnailDataUrl);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageDataUrl;
    });
}

/**
 * Generate thumbnail with specific position (for custom cropping)
 * @param {string} imageDataUrl - The original image as a data URL
 * @param {Object} position - Position object with x and y percentages (TOP-ALIGNED: y=25 default)
 * @param {number} targetWidth - Target width for thumbnail
 * @param {number} targetHeight - Target height for thumbnail
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<string>} - Thumbnail as data URL
 */
export async function generateThumbnailWithPosition(imageDataUrl, position, targetWidth = 600, targetHeight = 400, quality = 0.92) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to target dimensions
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            // Enable image smoothing for better quality
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Fill with a subtle background color
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            
            // Calculate the source rectangle based on position
            const aspectRatio = img.width / img.height;
            const targetAspectRatio = targetWidth / targetHeight;
            
            let srcX, srcY, srcWidth, srcHeight;
            
            if (aspectRatio > targetAspectRatio) {
                // Image is wider - we'll crop horizontally
                srcHeight = img.height;
                srcWidth = srcHeight * targetAspectRatio;
                srcY = 0;
                // Use position.x to determine horizontal crop position
                srcX = (img.width - srcWidth) * (position.x / 100);
            } else {
                // Image is taller - we'll crop vertically
                srcWidth = img.width;
                srcHeight = srcWidth / targetAspectRatio;
                srcX = 0;
                // Use position.y to determine vertical crop position
                srcY = (img.height - srcHeight) * (position.y / 100);
            }
            
            // Draw the cropped image
            ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, targetWidth, targetHeight);
            
            // Convert to data URL with specified quality
            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(thumbnailDataUrl);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageDataUrl;
    });
}

/**
 * Generate thumbnails for existing images in the database (Updated for v2.1)
 * @param {boolean} forceRegenerate - Whether to regenerate existing thumbnails
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Object>} Results object with processed and error counts
 */
export async function generateThumbnailsForExistingImages(forceRegenerate = false, progressCallback = null) {
    console.log('Starting thumbnail generation for existing images...');
    
    try {
        const allMedia = await database.loadAllMedia();
        let processed = 0;
        let skipped = 0;
        let errors = 0;
        
        for (let i = 0; i < allMedia.length; i++) {
            const item = allMedia[i];
            
            // Skip videos (they have their own thumbnail generation)
            if (item.mediaType === 'video') {
                skipped++;
                continue;
            }
            
            // Skip if already has thumbnail and not forcing regeneration
            if (item.thumbnailData && !forceRegenerate) {
                console.log(`Image ${item.id} already has thumbnail, skipping...`);
                skipped++;
                continue;
            }
            
            try {
                console.log(`Generating thumbnail for image ${item.id} (${i + 1}/${allMedia.length})...`);
                
                // Use position if available, otherwise TOP-ALIGNED default (y=25)
                const position = item.thumbnailPosition || { x: 50, y: 25 }; // TOP-ALIGNED
                const thumbnailData = await generateThumbnailWithPosition(
                    item.imageData, 
                    position, 
                    600, 
                    400, 
                    0.92
                );
                
                await database.updateMedia(item.id, {
                    thumbnailData: thumbnailData,
                    thumbnailPosition: position // Ensure position is saved
                });
                
                processed++;
                console.log(`✅ Thumbnail generated for image ${item.id}`);
                
                // Call progress callback if provided
                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: allMedia.length,
                        processed,
                        skipped,
                        errors,
                        currentItem: item.title || 'Untitled'
                    });
                }
                
            } catch (error) {
                console.error(`❌ Failed to generate thumbnail for image ${item.id}:`, error);
                errors++;
            }
        }
        
        const results = { processed, skipped, errors, total: allMedia.length };
        console.log(`Thumbnail generation complete:`, results);
        
        // Show user notification
        if (processed > 0) {
            showNotification(`Generated ${processed} thumbnails successfully! (${skipped} skipped, ${errors} errors)`, 'success');
        } else if (skipped > 0 && errors === 0) {
            showNotification(`All images already have thumbnails (${skipped} items checked)`, 'info');
        } else if (errors > 0) {
            showNotification(`Thumbnail generation failed for ${errors} items`, 'error');
        }
        
        return results;
    } catch (error) {
        console.error('Error in thumbnail generation process:', error);
        showNotification('Error during thumbnail generation: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Regenerate thumbnail for a specific item with new position
 * @param {number} itemId - Database ID of the item
 * @param {Object} newPosition - New position object with x and y percentages
 * @returns {Promise<boolean>} Success status
 */
export async function regenerateThumbnailForItem(itemId, newPosition) {
    try {
        const item = await database.getMediaById(itemId);
        if (!item) {
            throw new Error('Item not found');
        }
        
        // Skip videos
        if (item.mediaType === 'video') {
            console.log('Skipping thumbnail regeneration for video item');
            return false;
        }
        
        console.log(`Regenerating thumbnail for item ${itemId} with position:`, newPosition);
        
        const thumbnailData = await generateThumbnailWithPosition(
            item.imageData,
            newPosition,
            600,
            400,
            0.92
        );
        
        await database.updateMedia(itemId, {
            thumbnailData: thumbnailData,
            thumbnailPosition: newPosition
        });
        
        console.log(`✅ Thumbnail regenerated for item ${itemId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to regenerate thumbnail for item ${itemId}:`, error);
        throw error;
    }
}

/**
 * Add thumbnail generation UI controls (for admin/maintenance use)
 */
export function addThumbnailGenerationControls() {
    const databaseInfo = document.querySelector('.database-info');
    if (!databaseInfo) return;
    
    // Create thumbnail generation button
    const thumbnailBtn = document.createElement('button');
    thumbnailBtn.className = 'export-btn';
    thumbnailBtn.textContent = 'Generate Thumbnails';
    thumbnailBtn.title = 'Generate high-quality thumbnails for all images';
    
    thumbnailBtn.addEventListener('click', async () => {
        if (confirm('Generate high-quality thumbnails for all images? This may take a while.')) {
            thumbnailBtn.disabled = true;
            thumbnailBtn.textContent = 'Generating...';
            
            try {
                await generateThumbnailsForExistingImages(false, (progress) => {
                    thumbnailBtn.textContent = `Generating... (${progress.current}/${progress.total})`;
                });
                
                // Trigger reload
                window.dispatchEvent(new CustomEvent('mediaUpdated'));
            } catch (error) {
                console.error('Thumbnail generation failed:', error);
            } finally {
                thumbnailBtn.disabled = false;
                thumbnailBtn.textContent = 'Generate Thumbnails';
            }
        }
    });
    
    databaseInfo.appendChild(thumbnailBtn);
}