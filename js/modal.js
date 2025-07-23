// modal.js - Handles image/video modal display and interactions
// v2.6 - Consolidated logging with summary reporting

import { database } from './database.js';
import { displayOrganizedMetadata } from './metadata.js';
import { showNotification, downloadBlob, generateSafeFilename } from './utils.js';

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
        modalPreviewVideo.src = item.imageData;
        modalPreviewVideo.loop = true; // Enable loop by default
        modalPreviewVideo.muted = false; // Unmuted for user interaction
        
        // Try to play if autoplay requested
        if (autoplay) {
            // Add a small delay to ensure video is loaded
            setTimeout(() => {
                modalPreviewVideo.play().catch(e => {
                    console.log('Autoplay blocked by browser, user interaction required:', e);
                });
            }, 100);
        }
        
        // Setup video control handlers
        setupVideoControls(modalPreviewVideo);
    } else {
        // Show image, hide video
        modalPreviewVideo.style.display = 'none';
        videoControls.style.display = 'none';
        modalPreviewImg.style.display = 'block';
        modalPreviewImg.src = item.imageData;
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
function setupVideoControls(videoElement) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const loopToggleBtn = document.getElementById('loopToggleBtn');
    const loopIndicator = document.getElementById('loopIndicator');
    
    // Update play/pause button text
    function updatePlayPauseButton() {
        playPauseBtn.textContent = videoElement.paused ? '▶️ Play' : '⏸️ Pause';
    }
    
    // Update loop indicator
    function updateLoopIndicator() {
        loopIndicator.textContent = videoElement.loop ? '🔄 Loop: ON' : '🔄 Loop: OFF';
        loopToggleBtn.textContent = videoElement.loop ? '🔄 Disable Loop' : '🔄 Enable Loop';
    }
    
    // Play/Pause functionality
    playPauseBtn.onclick = () => {
        if (videoElement.paused) {
            videoElement.play().catch(e => {
                console.error('Error playing video:', e);
                showNotification('Unable to play video. Browser may be blocking autoplay.', 'error');
            });
        } else {
            videoElement.pause();
        }
    };
    
    // Loop toggle functionality
    loopToggleBtn.onclick = () => {
        videoElement.loop = !videoElement.loop;
        updateLoopIndicator();
    };
    
    // Update buttons when video state changes
    videoElement.addEventListener('play', updatePlayPauseButton);
    videoElement.addEventListener('pause', updatePlayPauseButton);
    videoElement.addEventListener('loadstart', () => {
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
            openFullSizeMedia(item.imageData, 'video');
        };
    } else {
        // For images, clicking opens full-size in overlay
        modalPreviewImg.onclick = (e) => {
            e.stopPropagation();
            openFullSizeMedia(item.imageData, 'image');
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
            if (video) {
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
        if (video) {
            video.pause();
        }
    };
    
    // Create media element
    let mediaElement;
    if (mediaType === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.controls = true;
        mediaElement.autoplay = true;
        mediaElement.loop = true; // Enable loop for full-size video too
        mediaElement.src = mediaSrc;
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
    if (!currentImageId) return;
    
    const mediaType = currentImageData.mediaType === 'video' ? 'video' : 'image';
    
    if (confirm(`Are you sure you want to delete this ${mediaType}?`)) {
        try {
            console.log(`🗑️ Starting deletion process for item ${currentImageId} (${mediaType})`);
            
            // STEP 1: Clean up modal media elements (individual logging for important elements)
            const modalResults = { success: 0, failed: 0, skipped: 0 };
            const modalVideo = document.getElementById('modalPreviewVideo');
            const modalImage = document.getElementById('modalPreviewImg');
            
            if (modalVideo) cleanupMediaElement(modalVideo, 'modal-video', modalResults);
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
                
                if (overlayVideo) cleanupMediaElement(overlayVideo, 'overlay-video', overlayResults);
                if (overlayImage) cleanupMediaElement(overlayImage, 'overlay-image', overlayResults);
                
                fullsizeOverlay.style.display = 'none';
                
                if (overlayResults.success > 0) {
                    console.log(`🧹 Overlay cleanup: ${overlayResults.success} elements cleaned`);
                }
            }
            
            // STEP 3: Delete from server if serverPath exists
            if (currentImageData.serverPath) {
                try {
                    const response = await fetch(`/delete/${encodeURIComponent(currentImageData.serverPath)}`, {
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
            console.log(`🗄️ Attempting to delete item ${currentImageId} from database...`);
            const deleteResult = await database.deleteMedia(currentImageId);
            console.log(`✅ Database deletion completed`);
            
            // STEP 5: Close modal
            closeModal();
            
            // STEP 6: Targeted gallery cleanup with batch processing
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
            
            // STEP 7: Wait for cleanup to complete, then reload
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

// Get current image data (for other modules)
export function getCurrentImageData() {
    return currentImageData;
}

// Get current image ID (for other modules)
export function getCurrentImageId() {
    return currentImageId;
}