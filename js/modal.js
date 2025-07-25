// modal.js - Handles image/video modal display and interactions
// v2.6 - Consolidated logging with summary reporting

import { database } from './database.js';
import { displayOrganizedMetadata } from './metadata.js';
import { showNotification, downloadBlob, generateSafeFilename } from './utils.js';
import { loadMiniGallery, switchToImage, removeImageFromView, isCurrentImageInGallery, getCurrentImageData, getCurrentImageId } from './minigallery.js';

let currentImageId = null;
let currentImageData = null;

// Open image/video modal with new two-column layout
export function openImageModal(item, autoplay = false) {
    currentImageId = item.id;
    currentImageData = item;
    const modal = document.getElementById('imageModal');
    
    // Get or create the new modal structure
    ensureModalStructure();
    
    const modalPreviewImg = document.getElementById('modalPreviewImg');
    const modalPreviewVideo = document.getElementById('modalPreviewVideo');
    const modalMediaTitle = document.getElementById('modalMediaTitle');
    const videoControls = document.getElementById('modalVideoControls');
    const downloadWorkflow = document.getElementById('downloadWorkflow');
    
    const isVideo = item.mediaType === 'video';
    
    // Set up media preview in left panel
    if (isVideo) {
        // Show video, hide image
        modalPreviewImg.style.display = 'none';
        modalPreviewVideo.style.display = 'block';
        videoControls.style.display = 'flex';
        
        // Set video source and attributes
        modalPreviewVideo.src = item.serverPath ? `${item.serverPath}` : '';
        
        // Initialize Plyr
        const player = new Plyr(modalPreviewVideo, {
            controls: [
                'play-large', // The large play button in the center
                'restart', // Restart playback
                'rewind', // Rewind by the seek time (default 10 seconds)
                'play', // Play/pause playback
                'fast-forward', // Fast forward by the seek time (default 10 seconds)
                'progress', // The progress bar and scrubber for playback and buffering
                'current-time', // The current time of playback
                'duration', // The full duration of the media
                'mute', // Toggle mute
                'volume', // Volume control
                'captions', // Toggle captions
                'settings', // Settings menu
                'pip', // Picture-in-picture (Chrome only)
                'airplay', // Airplay (Safari only)
                'download', // Show a download button with a link to either the source or a custom URL you specify in your options
                'fullscreen' // Toggle fullscreen
            ],
            settings: ['captions', 'quality', 'speed'],
            quality: {
                default: 576,
                options: [4320, 2880, 2160, 1440, 1080, 720, 576, 480, 360, 240]
            },
            tooltips: {
                controls: true,
                seek: true
            },
            keyboard: {
                focused: true,
                global: true
            }
        });
        
        // Store player instance for later use
        modalPreviewVideo.plyrInstance = player;
        
        // Try to play if autoplay requested
        if (autoplay) {
            // Add a small delay to ensure video is loaded
            setTimeout(() => {
                player.play().catch(e => {
                    console.log('Autoplay blocked by browser, user interaction required:', e);
                });
            }, 100);
        }
        
        // Setup video control handlers
        setupVideoControls(modalPreviewVideo, player);
    } else {
        // Show image, hide video
        modalPreviewVideo.style.display = 'none';
        videoControls.style.display = 'none';
        modalPreviewImg.style.display = 'block';
        modalPreviewImg.src = item.serverPath ? `${item.serverPath}` : '';
    }
    
    // Load mini-gallery if this item has related images
    loadMiniGallery(item);
    
    // Show "Add to Gallery" button for all images, hide for videos
    const addToGalleryBtn = document.getElementById('addToGallery');
    if (!isVideo) {
        addToGalleryBtn.style.display = 'inline-block';
    } else {
        addToGalleryBtn.style.display = 'none';
    }
    
    // Set title below media preview
    modalMediaTitle.textContent = item.title || 'Untitled';
    
    // Populate form fields in right panel
    document.getElementById('imageTitle').value = item.title || '';
    document.getElementById('imagePrompt').value = item.prompt || '';
    document.getElementById('imageModel').value = item.model || '';
    document.getElementById('imageTags').value = item.tags || '';
    document.getElementById('imageNotes').value = item.notes || '';
    
    // Check if this item has workflow data (only for images)
    const hasWorkflow = !isVideo && item.metadata && (item.metadata.workflow || item.metadata.prompt);
    if (hasWorkflow) {
        downloadWorkflow.style.display = 'inline-block';
    } else {
        downloadWorkflow.style.display = 'none';
    }
    
    // Display organized metadata
    displayOrganizedMetadata(item.metadata, isVideo);
    
    // Set up click handlers for full-size view
    setupFullSizeHandlers(item, isVideo);
    
    modal.style.display = 'block';
}

// Setup video control functionality
function setupVideoControls(videoElement, player) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const loopToggleBtn = document.getElementById('loopToggleBtn');
    const loopIndicator = document.getElementById('loopIndicator');
    
    // Update play/pause button text
    function updatePlayPauseButton() {
        playPauseBtn.textContent = player.paused ? '▶️ Play' : '⏸️ Pause';
    }
    
    // Update loop indicator
    function updateLoopIndicator() {
        loopIndicator.textContent = player.config.loop ? '🔄 Loop: ON' : '🔄 Loop: OFF';
        loopToggleBtn.textContent = player.config.loop ? '🔄 Disable Loop' : '🔄 Enable Loop';
    }
    
    // Play/Pause functionality
    playPauseBtn.onclick = () => {
        if (player.paused) {
            player.play().catch(e => {
                console.error('Error playing video:', e);
                showNotification('Unable to play video. Browser may be blocking autoplay.', 'error');
            });
        } else {
            player.pause();
        }
    };
    
    // Loop toggle functionality
    loopToggleBtn.onclick = () => {
        player.config.loop = !player.config.loop;
        updateLoopIndicator();
    };
    
    // Update buttons when video state changes
    player.on('play', updatePlayPauseButton);
    player.on('pause', updatePlayPauseButton);
    player.on('loadeddata', () => {
        updatePlayPauseButton();
        updateLoopIndicator();
    });
    
    // Initialize button states
    updatePlayPauseButton();
    updateLoopIndicator();
}

// Ensure the modal has the correct two-column structure
function ensureModalStructure() {
    const modal = document.getElementById('imageModal');
    const modalContent = modal.querySelector('.modal-content');
    
    // Check if we need to update the structure
    if (!modalContent.querySelector('.modal-left-panel')) {
        // Create new two-column structure with larger preview
        modalContent.innerHTML = `
            <span class="close" id="closeModal">&times;</span>
            
            <!-- Left Panel - Fixed with LARGER preview -->
            <div class="modal-left-panel">
                <div class="modal-media-preview">
                    <img id="modalPreviewImg" src="" alt="" style="display: none;">
                    <video id="modalPreviewVideo" controls style="display: none;">
                        <source src="" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
                
                <!-- Video Controls -->
                <div class="modal-video-controls" id="modalVideoControls" style="display: none;">
                    <button class="video-control-btn" id="playPauseBtn">▶️ Play</button>
                    <button class="video-control-btn" id="loopToggleBtn">🔄 Enable Loop</button>
                    <span class="loop-indicator" id="loopIndicator">🔄 Loop: OFF</span>
                </div>
                
                <div class="modal-media-title" id="modalMediaTitle" style="display: none;">Untitled</div>
                
                <!-- Mini-gallery thumbnail strip -->
                <div class="mini-gallery-strip" id="miniGalleryStrip" style="display: none;">
                    <h4>Related Images</h4>
                    <div class="mini-gallery-thumbnails" id="miniGalleryThumbnails"></div>
                </div>
            </div>
            
            <!-- Right Panel - Scrollable with COMPRESSED metadata -->
            <div class="modal-right-panel">
                <div class="metadata-form">
                    <div class="form-group">
                        <label for="imageTitle">Title:</label>
                        <input type="text" id="imageTitle" placeholder="Enter media title">
                    </div>
                    <div class="form-group">
                        <label for="imagePrompt">AI Prompt:</label>
                        <textarea id="imagePrompt" placeholder="Enter the AI prompt used to generate this media"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="imageModel">AI Model:</label>
                        <input type="text" id="imageModel" placeholder="e.g., DALL-E 3, Midjourney, Stable Diffusion, Sora">
                    </div>
                    <div class="form-group">
                        <label for="imageTags">Tags:</label>
                        <input type="text" id="imageTags" placeholder="Enter tags separated by commas">
                    </div>
                    <div class="form-group">
                        <label for="imageNotes">Notes:</label>
                        <textarea id="imageNotes" placeholder="Additional notes about this media"></textarea>
                    </div>
                    
                    <!-- Metadata display - COMPRESSED -->
                    <div class="form-group">
                        <label>📋 Media Metadata:</label>
                        <div class="metadata-display-section">
                            
                            <!-- Prompt Section -->
                            <div id="promptSection" style="display: none;">
                                <h4 style="color: #2c3e50; margin: 0 0 6px 0; font-size: 13px; font-family: Arial, sans-serif;">
                                    🎯 Prompt Data:
                                </h4>
                                <div id="promptDisplay" style="background: #e8f4f8; padding: 6px; border-radius: 4px; margin-bottom: 10px; border-left: 3px solid #3498db;">
                                    <em>No prompt data found</em>
                                </div>
                            </div>
                            
                            <!-- Workflow Section -->
                            <div id="workflowSection" style="display: none;">
                                <h4 style="color: #2c3e50; margin: 0 0 6px 0; font-size: 13px; font-family: Arial, sans-serif;">
                                    🔧 Workflow Data:
                                </h4>
                                <div id="workflowDisplay" style="background: #fff3cd; padding: 6px; border-radius: 4px; margin-bottom: 10px; border-left: 3px solid #ffc107;">
                                    <em>No workflow data found</em>
                                </div>
                            </div>
                            
                            <!-- Other Metadata Section -->
                            <div id="otherMetadataSection" style="display: none;">
                                <h4 style="color: #2c3e50; margin: 0 0 6px 0; font-size: 13px; font-family: Arial, sans-serif;">
                                    📄 Other Metadata:
                                </h4>
                                <div id="otherMetadataDisplay" style="background: #f8f9fa; padding: 6px; border-radius: 4px; border-left: 3px solid #6c757d;">
                                    <em>No other metadata found</em>
                                </div>
                            </div>
                            
                            <!-- No metadata message -->
                            <div id="noMetadataMessage" style="text-align: center; color: #6c757d; font-style: italic;">
                                No metadata found
                            </div>
                            
                        </div>
                    </div>
                    
                    <!-- Buttons Section -->
                    <div class="modal-buttons">
                        <button class="btn" id="saveMetadata">Save Changes</button>
                        <button class="btn btn-secondary" id="addToGallery" style="display: none;">Add to Gallery</button>
                        <button class="btn btn-danger" id="deleteImage">Delete Media</button>
                        <button class="btn btn-workflow" id="downloadWorkflow" style="display: none;">Download ComfyUI Workflow</button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Setup click handlers for full-size media view
function setupFullSizeHandlers(item, isVideo) {
    const modalPreviewImg = document.getElementById('modalPreviewImg');
    const modalPreviewVideo = document.getElementById('modalPreviewVideo');
    
    // Remove existing handlers
    modalPreviewImg.onclick = null;
    modalPreviewVideo.onclick = null;
    
    if (isVideo) {
        // For videos, clicking opens full-size in overlay
        modalPreviewVideo.onclick = (e) => {
            e.stopPropagation();
            openFullSizeMedia(item.serverPath ? `${item.serverPath}` : '', 'video');
        };
    } else {
        // For images, clicking opens full-size in overlay
        modalPreviewImg.onclick = (e) => {
            e.stopPropagation();
            openFullSizeMedia(item.serverPath ? `${item.serverPath}` : '', 'image');
        };
    }
}

// Open full-size media in overlay
function openFullSizeMedia(mediaSrc, mediaType) {
    // Create or get existing overlay
    let overlay = document.getElementById('fullsizeOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'fullsizeOverlay';
        overlay.className = 'fullsize-overlay';
        document.body.appendChild(overlay);
        
        // Close on click
        overlay.onclick = () => {
            overlay.style.display = 'none';
            // Stop video if it's playing
            const video = overlay.querySelector('video');
            if (video && video.plyrInstance) {
                video.plyrInstance.stop();
            } else if (video) {
                video.pause();
            }
        };
    }
    
    // Create X close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'fullsize-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        overlay.style.display = 'none';
        const video = overlay.querySelector('video');
        if (video && video.plyrInstance) {
            video.plyrInstance.stop();
        } else if (video) {
            video.pause();
        }
    };
    
    // Create media element
    let mediaElement;
    if (mediaType === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.src = mediaSrc;
        
        // Initialize Plyr for full-size video
        const player = new Plyr(mediaElement, {
            controls: [
                'play-large',
                'play',
                'progress',
                'current-time',
                'duration',
                'mute',
                'volume',
                'fullscreen'
            ],
            tooltips: {
                controls: true,
                seek: true
            },
            keyboard: {
                focused: true,
                global: true
            },
            fullscreen: {
                enabled: true,
                fallback: true,
                iosNative: true
            }
        });
        
        // Store player instance
        mediaElement.plyrInstance = player;
        
        // Start playing
        setTimeout(() => {
            player.play().catch(e => {
                console.log('Autoplay blocked for full-size video:', e);
            });
        }, 100);
    } else {
        mediaElement = document.createElement('img');
        mediaElement.src = mediaSrc;
    }
    
    mediaElement.className = 'fullsize-media';
    
    // Prevent media click from closing overlay
    mediaElement.onclick = (e) => e.stopPropagation();
    
    // Clear previous content and add new media and close button
    overlay.innerHTML = '';
    overlay.appendChild(closeBtn);
    overlay.appendChild(mediaElement);
    
    // Show overlay
    overlay.style.display = 'flex';
}

// Save metadata (works for both images and videos)
export async function saveImageMetadata() {
    if (!currentImageId) return;
    
    const updatedData = {
        title: document.getElementById('imageTitle').value,
        prompt: document.getElementById('imagePrompt').value,
        model: document.getElementById('imageModel').value,
        tags: document.getElementById('imageTags').value,
        notes: document.getElementById('imageNotes').value
    };
    
    try {
        await database.updateMedia(currentImageId, updatedData);
        
        // Update the title in the modal
        const modalMediaTitle = document.getElementById('modalMediaTitle');
        if (modalMediaTitle) {
            modalMediaTitle.textContent = updatedData.title || 'Untitled';
        }
        
        // Trigger reload in main app
        window.dispatchEvent(new CustomEvent('mediaUpdated'));
        
        showNotification('Changes saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving metadata:', error);
        showNotification('Error saving changes: ' + error.message, 'error');
    }
}

// Enhanced media cleanup utility function - SILENT WITH RESULT TRACKING
function cleanupMediaElement(element, elementType = 'unknown', trackResults = null) {
    if (!element) {
        if (trackResults) trackResults.skipped++;
        return false;
    }
    
    try {
        // For video elements
        if (element.tagName === 'VIDEO' || elementType.includes('video')) {
            // Pause the video first
            if (typeof element.pause === 'function') {
                element.pause();
            }
            
            // Remove all event listeners to prevent further errors
            element.onloadstart = null;
            element.onloadeddata = null;
            element.onerror = null;
            element.onended = null;
            element.onplay = null;
            element.onpause = null;
            element.oncanplay = null;
            element.onloadedmetadata = null;
            element.onstalled = null;
            element.onsuspend = null;
            element.onabort = null;
            element.onemptied = null;
            
            // IMPORTANT: Handle source elements BEFORE clearing main src
            const sources = element.querySelectorAll('source');
            sources.forEach(source => {
                // Add silent error handler to source elements
                source.onerror = () => {};
                source.onabort = () => {};
                // Remove the source element entirely instead of just clearing src
                if (source.parentNode) {
                    source.parentNode.removeChild(source);
                }
            });
            
            // Clear the main video source
            const currentSrc = element.src;
            if (currentSrc && currentSrc.startsWith('blob:')) {
                URL.revokeObjectURL(currentSrc);
            }
            
            // Add comprehensive silent error handler BEFORE clearing src
            element.onerror = () => {};
            element.onabort = () => {};
            element.onstalled = () => {};
            element.onsuspend = () => {};
            element.onemptied = () => {};
            
            // Clear main source
            element.src = '';
            element.removeAttribute('src');
            
            // Call load() to cancel any pending network requests
            if (typeof element.load === 'function') {
                element.load();
            }
            
            // Additional cleanup - briefly hide the element to force browser cleanup
            const originalDisplay = element.style.display;
            element.style.display = 'none';
            // Use requestAnimationFrame to ensure the display change is processed
            requestAnimationFrame(() => {
                element.style.display = originalDisplay;
            });
        }
        
        // For image elements
        if (element.tagName === 'IMG' || elementType.includes('image')) {
            const currentSrc = element.src;
            if (currentSrc && currentSrc.startsWith('blob:')) {
                URL.revokeObjectURL(currentSrc);
            }
            
            // Add silent error handler
            element.onerror = () => {};
            element.onload = () => {};
            element.onabort = () => {};
            
            element.src = '';
            element.removeAttribute('src');
        }
        
        if (trackResults) trackResults.success++;
        return true;
    } catch (cleanupError) {
        if (trackResults) trackResults.failed++;
        return false;
    }
}

// Batch cleanup function with summary reporting
function performBatchCleanup(elements, elementType, description) {
    if (!elements || elements.length === 0) return;
    
    const results = { success: 0, failed: 0, skipped: 0 };
    
    elements.forEach(element => {
        // Destroy Plyr instance if it exists
        if (element.plyrInstance) {
            element.plyrInstance.destroy();
            delete element.plyrInstance;
        }
        cleanupMediaElement(element, elementType, results);
    });
    
    const total = results.success + results.failed + results.skipped;
    if (total > 0) {
        console.log(`🧹 ${description}: ${total} elements processed (✅ ${results.success} cleaned, ❌ ${results.failed} failed, ⏭️ ${results.skipped} skipped)`);
    }
    
    return results;
}

// Delete current item (works for both images and videos) - CONSOLIDATED LOGGING
export async function deleteCurrentImage() {
    // Get the current image data from minigallery (which tracks the active image)
    const activeImageId = getCurrentImageId();
    const activeImageData = getCurrentImageData();
    
    if (!activeImageId || !activeImageData) {
        console.error('No active image found for deletion');
        return;
    }
    
    const mediaType = activeImageData.mediaType === 'video' ? 'video' : 'image';
    
    // Check if this is part of a gallery and if it's the main image
    const isGalleryItem = activeImageData.galleryId && activeImageData.galleryId > 0;
    let isMainGalleryImage = false;
    let galleryImages = [];
    
    console.log('🔍 DELETION DEBUG - Starting deletion check for image:', {
        currentImageId: activeImageId,
        galleryId: activeImageData.galleryId,
        isGalleryItem,
        mediaType: activeImageData.mediaType
    });
    
    if (isGalleryItem) {
        // Get all images in this gallery
        galleryImages = await database.getMediaByGalleryId(activeImageData.galleryId);
        console.log('🔍 DELETION DEBUG - All gallery items:', galleryImages.map(img => ({
            id: img.id,
            mediaType: img.mediaType,
            title: img.title
        })));
        
        // Filter to only images (no videos)
        const galleryImageItems = galleryImages.filter(img => img.mediaType === 'image');
        console.log('🔍 DELETION DEBUG - Gallery image items only:', galleryImageItems.map(img => ({
            id: img.id,
            title: img.title
        })));
        
        // The main image is the one with the LOWEST ID (first one added to the gallery)
        if (galleryImageItems.length > 0) {
            const mainImage = galleryImageItems.reduce((min, img) => img.id < min.id ? img : min, galleryImageItems[0]);
            isMainGalleryImage = activeImageId === mainImage.id;
            
            console.log('🔍 DELETION DEBUG - Main image analysis:', {
                mainImageId: mainImage.id,
                mainImageTitle: mainImage.title,
                currentImageId: activeImageId,
                isMainGalleryImage,
                galleryImageCount: galleryImageItems.length
            });
        }
        
        // If this is the main gallery image and there are other images in the gallery, prevent deletion
        if (isMainGalleryImage && galleryImageItems.length > 1) {
            console.log('🚫 DELETION DEBUG - Blocking deletion of main gallery image');
            alert(`This is the main image for this gallery and cannot be deleted while other images are in the gallery. ` +
                  `To delete this image, first remove all other images from the gallery.`);
            return;
        } else {
            console.log('✅ DELETION DEBUG - Allowing deletion:', {
                isMainGalleryImage,
                galleryImageCount: galleryImageItems.length,
                reason: isMainGalleryImage ? 'Main image but only one in gallery' : 'Not main image'
            });
        }
    } else {
        console.log('✅ DELETION DEBUG - Not a gallery item, allowing deletion');
    }
    
    if (confirm(`Are you sure you want to delete this ${mediaType}?`)) {
        try {
            console.log(`🗑️ Starting deletion process for item ${activeImageId} (${mediaType})`);
            
            // STEP 1: Clean up modal media elements (individual logging for important elements)
            const modalResults = { success: 0, failed: 0, skipped: 0 };
            const modalVideo = document.getElementById('modalPreviewVideo');
            const modalImage = document.getElementById('modalPreviewImg');
            
            if (modalVideo) {
                // Destroy Plyr instance if it exists
                if (modalVideo.plyrInstance) {
                    modalVideo.plyrInstance.destroy();
                    delete modalVideo.plyrInstance;
                }
                cleanupMediaElement(modalVideo, 'modal-video', modalResults);
            }
            if (modalImage) cleanupMediaElement(modalImage, 'modal-image', modalResults);
            
            if (modalResults.success > 0) {
                console.log(`🧹 Modal cleanup: ${modalResults.success} elements cleaned successfully`);
            }
            
            // STEP 2: Clean up any fullsize overlay
            const fullsizeOverlay = document.getElementById('fullsizeOverlay');
            if (fullsizeOverlay && fullsizeOverlay.style.display !== 'none') {
                const overlayResults = { success: 0, failed: 0, skipped: 0 };
                const overlayVideo = fullsizeOverlay.querySelector('video');
                const overlayImage = fullsizeOverlay.querySelector('img');
                
                if (overlayVideo) {
                    // Destroy Plyr instance if it exists
                    if (overlayVideo.plyrInstance) {
                        overlayVideo.plyrInstance.destroy();
                        delete overlayVideo.plyrInstance;
                    }
                    cleanupMediaElement(overlayVideo, 'overlay-video', overlayResults);
                }
                if (overlayImage) cleanupMediaElement(overlayImage, 'overlay-image', overlayResults);
                
                fullsizeOverlay.style.display = 'none';
                
                if (overlayResults.success > 0) {
                    console.log(`🧹 Overlay cleanup: ${overlayResults.success} elements cleaned`);
                }
            }
            
            // STEP 3: Delete from server if serverPath exists
            if (activeImageData.serverPath) {
                try {
                    const response = await fetch(`/delete/${encodeURIComponent(activeImageData.serverPath)}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        console.log('✅ File deleted from server');
                    } else {
                        console.warn('⚠️ Server file deletion failed, continuing with database deletion');
                    }
                } catch (serverError) {
                    console.warn('⚠️ Server delete request failed:', serverError);
                    // Continue with database deletion even if server deletion fails
                }
            }
            
            // STEP 4: Delete from database
            console.log(`🗄️ Attempting to delete item ${activeImageId} from database...`);
            const deleteResult = await database.deleteMedia(activeImageId);
            console.log(`✅ Database deletion completed`);
            
            // STEP 5: Handle gallery vs standalone image deletion
            if (isCurrentImageInGallery()) {
                // This is a gallery image, update the mini-gallery view instead of closing modal
                console.log('🖼️ Removing image from mini-gallery view');
                removeImageFromView(activeImageId);
                
                // Switch to the next image in the gallery if available
                const relatedImages = await database.getMediaByGalleryId(activeImageData.galleryId);
                const otherImages = relatedImages.filter(img => img.id !== activeImageId && img.mediaType === 'image');
                
                if (otherImages.length > 0) {
                    // Switch to the first available image
                    const nextImage = await database.getMediaById(otherImages[0].id);
                    if (nextImage) {
                        const updatedItem = switchToImage(nextImage);
                        currentImageData = updatedItem;
                        // Reload mini-gallery with the new current image
                        await loadMiniGallery(updatedItem);
                    }
                } else {
                    // No more images in gallery, close modal
                    closeModal();
                }
            } else {
                // This is a standalone image, close modal and refresh main gallery
                // STEP 6: Close modal
                closeModal();
                
                // STEP 7: Targeted gallery cleanup with batch processing
                const gallery = document.getElementById('gallery');
                if (gallery) {
                    // Count and clean videos
                    const galleryVideos = gallery.querySelectorAll('video');
                    const galleryBlobImages = gallery.querySelectorAll('img[src^="blob:"]');
                    
                    let totalCleaned = 0;
                    
                    if (galleryVideos.length > 0) {
                        const videoResults = performBatchCleanup(galleryVideos, 'gallery-video', 'Gallery videos');
                        totalCleaned += videoResults.success;
                    }
                    
                    if (galleryBlobImages.length > 0) {
                        const imageResults = performBatchCleanup(galleryBlobImages, 'gallery-blob-image', 'Gallery blob images');
                        totalCleaned += imageResults.success;
                    }
                    
                    // Clear the entire gallery HTML after targeted cleanup
                    gallery.innerHTML = '';
                    console.log(`🧹 Gallery cleanup completed: ${totalCleaned} media elements cleaned, DOM cleared`);
                }
            }
            
            // STEP 8: Wait for cleanup to complete, then reload
            setTimeout(() => {
                console.log('🔄 Triggering media reload after cleanup...');
                window.dispatchEvent(new CustomEvent('mediaUpdated'));
            }, 400);
            
            showNotification(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} deleted successfully!`, 'success');
        } catch (error) {
            console.error('❌ Error deleting media:', error);
            showNotification('Error deleting media: ' + error.message, 'error');
        }
    }
}

// Download current item's workflow (images only)
export function downloadCurrentWorkflow() {
    if (!currentImageData || !currentImageData.metadata) {
        showNotification('No workflow data available for this item!', 'error');
        return;
    }
    
    if (currentImageData.mediaType === 'video') {
        showNotification('Workflow download is not available for video files.', 'error');
        return;
    }
    
    const hasWorkflow = currentImageData.metadata.workflow || currentImageData.metadata.prompt;
    if (!hasWorkflow) {
        showNotification('No ComfyUI workflow data available for this image!', 'error');
        return;
    }
    
    let workflowJson = null;
    let promptJson = null;
    
    // Extract and parse workflow data
    if (currentImageData.metadata.workflow) {
        try {
            workflowJson = JSON.parse(currentImageData.metadata.workflow);
        } catch (e) {
            console.error('Error parsing workflow:', e);
            showNotification('Error: Invalid workflow data format', 'error');
            return;
        }
    }
    
    // Extract and parse prompt data
    if (currentImageData.metadata.prompt) {
        try {
            promptJson = JSON.parse(currentImageData.metadata.prompt);
        } catch (e) {
            console.error('Error parsing prompt:', e);
            // If prompt fails to parse, it's not critical
        }
    }
    
    // Create the export data in ComfyUI's expected format
    let exportData;
    
    if (workflowJson) {
        // Export the raw workflow JSON for ComfyUI import
        exportData = workflowJson;
    } else if (promptJson) {
        // If only prompt data exists, wrap it appropriately
        exportData = {
            prompt: promptJson,
            metadata: {
                exported_from: 'AI Media Gallery',
                image_title: currentImageData.title || 'Untitled',
                export_date: new Date().toISOString()
            }
        };
    } else {
        showNotification('No valid workflow data found!', 'error');
        return;
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const filename = generateSafeFilename(currentImageData.title, 'workflow') + '.json';
    
    downloadBlob(blob, filename);
    
    showNotification(`Downloaded ComfyUI workflow for "${currentImageData.title || 'Untitled'}"! This file can be directly imported into ComfyUI.`, 'success');
}

// Enhanced close modal with consolidated cleanup logging
export function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    
    // Silent cleanup with result tracking
    const results = { success: 0, failed: 0, skipped: 0 };
    
    // Clean up modal video
    const modalVideo = document.getElementById('modalPreviewVideo');
    if (modalVideo) {
        // Destroy Plyr instance if it exists
        if (modalVideo.plyrInstance) {
            modalVideo.plyrInstance.destroy();
            delete modalVideo.plyrInstance;
        }
        cleanupMediaElement(modalVideo, 'modal-video-close', results);
    }
    
    // Clean up modal image
    const modalImage = document.getElementById('modalPreviewImg');
    if (modalImage) {
        cleanupMediaElement(modalImage, 'modal-image-close', results);
    }
    
    // Clean up full-size overlay
    const fullsizeOverlay = document.getElementById('fullsizeOverlay');
    if (fullsizeOverlay && fullsizeOverlay.style.display !== 'none') {
        fullsizeOverlay.style.display = 'none';
        
        const overlayVideo = fullsizeOverlay.querySelector('video');
        const overlayImage = fullsizeOverlay.querySelector('img');
        
        if (overlayVideo) {
            // Destroy Plyr instance if it exists
            if (overlayVideo.plyrInstance) {
                overlayVideo.plyrInstance.destroy();
                delete overlayVideo.plyrInstance;
            }
            cleanupMediaElement(overlayVideo, 'overlay-video', results);
        }
        if (overlayImage) {
            cleanupMediaElement(overlayImage, 'overlay-image', results);
        }
    }
    
    // Log summary only if we actually cleaned something
    if (results.success > 0 || results.failed > 0) {
        console.log(`🚪 Modal closed: ${results.success} elements cleaned${results.failed > 0 ? `, ${results.failed} failed` : ''}`);
    }
    
    currentImageId = null;
    currentImageData = null;
}

// Setup modal event listeners
export function setupModalEventListeners() {
    const modal = document.getElementById('imageModal');

    // Modal events (using event delegation since content is dynamic)
    modal.addEventListener('click', (e) => {
        // Close modal if clicking the modal background
        if (e.target === modal) {
            closeModal();
        }
        
        // Handle button clicks
        if (e.target.id === 'closeModal') {
            closeModal();
        } else if (e.target.id === 'saveMetadata') {
            saveImageMetadata();
        } else if (e.target.id === 'addToGallery') {
            addToGallery();
        } else if (e.target.id === 'deleteImage') {
            deleteCurrentImage();
        } else if (e.target.id === 'downloadWorkflow') {
            downloadCurrentWorkflow();
        }
    });
    
    // Handle escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// Add current image to gallery
async function addToGallery() {
    if (!currentImageId || !currentImageData) return;
    
    // Create upload interface for gallery images
    const uploadedFiles = await uploadGalleryImages();
    
    if (uploadedFiles && uploadedFiles.length > 0) {
        try {
            // Process uploaded files through the normal upload pipeline
            const { handleFileSelect } = await import('./mediaProcessor.js');
            
            // Create a mock file input element for the media processor
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            fileInput.files = createFileList(uploadedFiles);
            
            // Process the files
            handleFileSelect(fileInput, database, async (results) => {
                if (results && results.length > 0) {
                    // Get the gallery ID (use existing or create new)
                    const galleryId = currentImageData.galleryId || Date.now();
                    
                    // Update current image with gallery ID if it doesn't have one
                    if (!currentImageData.galleryId || currentImageData.galleryId === 0) {
                        await database.updateMedia(currentImageId, { galleryId: galleryId });
                    }
                    
                    // Update all newly uploaded images with the same gallery ID
                    const successfulUploads = results.filter(result => result.success);
                    for (const result of successfulUploads) {
                        if (result.imageId) {
                            await database.updateMedia(result.imageId, { galleryId: galleryId });
                        }
                    }
                    
                    showNotification(`Added ${successfulUploads.length} images to gallery`, 'success');
                    
                    // Reload the modal to show the mini-gallery
                    const updatedItem = await database.getMediaById(currentImageId);
                    currentImageData = updatedItem;
                    loadMiniGallery(updatedItem);
                    
                    // Trigger reload in main app
                    window.dispatchEvent(new CustomEvent('mediaUpdated'));
                } else {
                    showNotification('No images were successfully uploaded', 'error');
                }
            });
        } catch (error) {
            console.error('Error processing gallery images:', error);
            showNotification('Error processing gallery images: ' + error.message, 'error');
        }
    }
}

// Create a FileList from an array of File objects
function createFileList(files) {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    return dataTransfer.files;
}

// Upload interface for gallery images
function uploadGalleryImages() {
    return new Promise((resolve) => {
        // Create upload modal
        const uploadModal = document.createElement('div');
        uploadModal.className = 'modal gallery-upload-modal';
        uploadModal.style.display = 'block';
        uploadModal.style.zIndex = '2001';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content gallery-upload-content';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'gallery-upload-header';
        header.innerHTML = `
            <span class="close" id="closeUploadModal">&times;</span>
            <h3>Add Images to Gallery</h3>
            <p>Upload images to add to this gallery</p>
        `;
        
        // Create upload area
        const uploadArea = document.createElement('div');
        uploadArea.className = 'upload-area gallery-upload-area';
        uploadArea.innerHTML = `
            <div class="upload-area-content">
                <p>Drag & drop images here or click to select files</p>
                <input type="file" id="galleryFileInput" multiple accept="image/*" style="display: none;">
            </div>
        `;
        
        // Add drag and drop functionality
        const fileInput = uploadArea.querySelector('#galleryFileInput');
        let uploadedFiles = [];
        
        // Click to select files
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                uploadedFiles = Array.from(e.target.files);
                updateFilePreview();
            }
        });
        
        // Drag and drop functionality
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                // Filter to only image files
                uploadedFiles = Array.from(e.dataTransfer.files).filter(file => 
                    file.type.startsWith('image/')
                );
                updateFilePreview();
            }
        });
        
        // Create file preview area
        const previewArea = document.createElement('div');
        previewArea.id = 'galleryFilePreview';
        previewArea.className = 'gallery-file-preview';
        
        // Update file preview
        function updateFilePreview() {
            previewArea.innerHTML = '';
            previewArea.style.display = uploadedFiles.length > 0 ? 'block' : 'none';
            
            if (uploadedFiles.length > 0) {
                const previewTitle = document.createElement('h4');
                previewTitle.textContent = `Selected Files (${uploadedFiles.length})`;
                previewTitle.className = 'preview-title';
                previewArea.appendChild(previewTitle);
                
                const fileList = document.createElement('div');
                fileList.className = 'file-list';
                
                uploadedFiles.forEach((file, index) => {
                    const fileContainer = document.createElement('div');
                    fileContainer.className = 'file-container';
                    
                    const fileElement = document.createElement('img');
                    fileElement.className = 'file-preview';
                    
                    // Create object URL for preview
                    const objectUrl = URL.createObjectURL(file);
                    fileElement.src = objectUrl;
                    
                    const fileName = document.createElement('div');
                    fileName.textContent = file.name;
                    fileName.className = 'file-name';
                    
                    const fileInfo = document.createElement('div');
                    fileInfo.textContent = `${(file.size / 1024).toFixed(1)} KB`;
                    fileInfo.className = 'file-info';
                    
                    fileContainer.appendChild(fileElement);
                    fileContainer.appendChild(fileName);
                    fileContainer.appendChild(fileInfo);
                    fileList.appendChild(fileContainer);
                });
                
                previewArea.appendChild(fileList);
            }
        }
        
        // Create buttons
        const buttons = document.createElement('div');
        buttons.className = 'gallery-upload-buttons';
        
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'btn btn-primary';
        uploadBtn.textContent = 'Add to Gallery';
        uploadBtn.addEventListener('click', () => {
            uploadModal.remove();
            resolve(uploadedFiles);
        });
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            uploadModal.remove();
            resolve(null);
        });
        
        buttons.appendChild(cancelBtn);
        buttons.appendChild(uploadBtn);
        
        // Close button functionality
        header.querySelector('#closeUploadModal').addEventListener('click', () => {
            uploadModal.remove();
            resolve(null);
        });
        
        // Close on escape key
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') {
                uploadModal.remove();
                resolve(null);
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
        
        // Close on click outside
        uploadModal.addEventListener('click', (e) => {
            if (e.target === uploadModal) {
                uploadModal.remove();
                resolve(null);
            }
        });
        
        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(uploadArea);
        modalContent.appendChild(previewArea);
        modalContent.appendChild(buttons);
        uploadModal.appendChild(modalContent);
        document.body.appendChild(uploadModal);
    });
}

// Simple image selection interface
function selectImagesForGallery(images) {
    return new Promise((resolve) => {
        // Create selection modal
        const selectionModal = document.createElement('div');
        selectionModal.className = 'modal';
        selectionModal.style.display = 'block';
        selectionModal.style.zIndex = '2001';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '800px';
        modalContent.style.maxHeight = '80vh';
        modalContent.style.overflowY = 'auto';
        
        // Create header
        const header = document.createElement('div');
        header.innerHTML = `
            <span class="close" id="closeSelectionModal">&times;</span>
            <h3>Select Images for Gallery</h3>
            <p>Select images to group together in a gallery (current image is automatically included)</p>
        `;
        
        // Create image grid
        const imageGrid = document.createElement('div');
        imageGrid.style.display = 'grid';
        imageGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
        imageGrid.style.gap = '10px';
        imageGrid.style.margin = '20px 0';
        
        // Add images to grid
        images.forEach(img => {
            const imageContainer = document.createElement('div');
            imageContainer.style.position = 'relative';
            imageContainer.style.cursor = 'pointer';
            
            const imgElement = document.createElement('img');
            imgElement.src = img.serverPath ? `${img.serverPath}` : '';
            imgElement.style.width = '100%';
            imgElement.style.height = '150px';
            imgElement.style.objectFit = 'cover';
            imgElement.style.border = '2px solid transparent';
            imgElement.style.borderRadius = '5px';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.position = 'absolute';
            checkbox.style.top = '5px';
            checkbox.style.left = '5px';
            checkbox.checked = img.id === currentImageId; // Auto-select current image
            checkbox.disabled = img.id === currentImageId; // Can't deselect current image
            
            const title = document.createElement('div');
            title.textContent = img.title || 'Untitled';
            title.style.fontSize = '12px';
            title.style.textAlign = 'center';
            title.style.marginTop = '5px';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            title.style.whiteSpace = 'nowrap';
            
            // Toggle selection on image click
            imageContainer.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    imgElement.style.border = checkbox.checked ? '2px solid #3498db' : '2px solid transparent';
                }
            });
            
            // Highlight selected images
            if (checkbox.checked) {
                imgElement.style.border = '2px solid #3498db';
            }
            
            imageContainer.appendChild(imgElement);
            imageContainer.appendChild(checkbox);
            imageContainer.appendChild(title);
            imageGrid.appendChild(imageContainer);
        });
        
        // Create buttons
        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.justifyContent = 'center';
        buttons.style.gap = '10px';
        buttons.style.marginTop = '20px';
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn';
        confirmBtn.textContent = 'Create Gallery';
        confirmBtn.addEventListener('click', () => {
            const selectedImages = images.filter((img, index) => {
                const checkbox = imageGrid.querySelectorAll('input[type="checkbox"]')[index];
                return checkbox.checked;
            });
            selectionModal.remove();
            resolve(selectedImages);
        });
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            selectionModal.remove();
            resolve(null);
        });
        
        buttons.appendChild(confirmBtn);
        buttons.appendChild(cancelBtn);
        
        // Close button functionality
        header.querySelector('#closeSelectionModal').addEventListener('click', () => {
            selectionModal.remove();
            resolve(null);
        });
        
        // Close on escape key
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') {
                selectionModal.remove();
                resolve(null);
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
        
        // Close on click outside
        selectionModal.addEventListener('click', (e) => {
            if (e.target === selectionModal) {
                selectionModal.remove();
                resolve(null);
            }
        });
        
        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(imageGrid);
        modalContent.appendChild(buttons);
        selectionModal.appendChild(modalContent);
        document.body.appendChild(selectionModal);
    });
}

// Get current image data (for other modules)
// These functions have been moved to minigallery.js

// These functions have been moved to minigallery.js
