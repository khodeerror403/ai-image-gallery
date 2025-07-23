// modal.js - Handles image/video modal display and interactions
// v2.3 - Complete version with larger preview, fixed video playback and loop controls

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

// Delete current item (works for both images and videos) - WITH GALLERY CLEARING FIX
export async function deleteCurrentImage() {
    if (!currentImageId) return;
    
    const mediaType = currentImageData.mediaType === 'video' ? 'video' : 'image';
    
    if (confirm(`Are you sure you want to delete this ${mediaType}?`)) {
        try {
            console.log(`🗑️ Starting deletion process for item ${currentImageId} (${mediaType})`);
            
            // First, delete from server if serverPath exists
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
            
            // Delete from database with better error handling
            console.log(`🗄️ Attempting to delete item ${currentImageId} from database...`);
            const deleteResult = await database.deleteMedia(currentImageId);
            console.log(`✅ Database deletion result:`, deleteResult);
            
            // Close modal
            closeModal();
            
            // Clear the gallery completely before reload to prevent stale references
            const gallery = document.getElementById('gallery');
            if (gallery) {
                // Find and clear any video elements in gallery cards
                const videoElements = gallery.querySelectorAll('video, img[src*="data:video"]');
                videoElements.forEach(element => {
                    if (element.tagName === 'VIDEO') {
                        element.pause();
                        element.src = '';
                        element.load();
                    } else {
                        element.src = '';
                    }
                });
                
                // Clear the entire gallery to remove any stale DOM references
                gallery.innerHTML = '';
                console.log('🧹 Gallery cleared before reload');
            }
            
            // Small delay to ensure cleanup is complete before reload
            setTimeout(() => {
                console.log('🔄 Triggering media reload after cleanup...');
                window.dispatchEvent(new CustomEvent('mediaUpdated'));
            }, 300);
            
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

// Close modal
export function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    
    // Stop any playing video in modal and clean up sources
    const modalVideo = document.getElementById('modalPreviewVideo');
    if (modalVideo) {
        modalVideo.pause();
        
        // If the src is a blob URL, revoke it to prevent memory leaks
        if (modalVideo.src && modalVideo.src.startsWith('blob:')) {
            URL.revokeObjectURL(modalVideo.src);
        }
        
        modalVideo.src = '';
        modalVideo.removeAttribute('src');
        modalVideo.load();
        
        // Add error handler to suppress any remaining "Invalid URI" errors
        modalVideo.onerror = () => {
            // Silently ignore errors after deletion
        };
    }
    
    // Clear image source as well
    const modalImage = document.getElementById('modalPreviewImg');
    if (modalImage) {
        modalImage.src = '';
        modalImage.onerror = () => {
            // Silently ignore errors after deletion
        };
    }
    
    // Close full-size overlay if open
    const fullsizeOverlay = document.getElementById('fullsizeOverlay');
    if (fullsizeOverlay) {
        fullsizeOverlay.style.display = 'none';
        const video = fullsizeOverlay.querySelector('video');
        if (video) {
            video.pause();
            if (video.src && video.src.startsWith('blob:')) {
                URL.revokeObjectURL(video.src);
            }
            video.src = '';
            video.onerror = () => {
                // Silently ignore errors
            };
        }
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