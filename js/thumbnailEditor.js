// thumbnailEditor.js - Handles thumbnail position editing functionality

import { database } from './database.js';
import { showNotification } from './utils.js';

let thumbnailEditImageId = null;
let currentPosition = { x: 50, y: 25 }; // TOP-ALIGNED default: 25% from top instead of 50% center
let imageNaturalDimensions = { width: 0, height: 0 };
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Setup thumbnail position picker
export function setupThumbnailPositionPicker() {
    // Create thumbnail position modal HTML with new compact design
    const thumbnailModalHtml = `
        <div id="thumbnailModal" class="modal thumbnail-modal">
            <div class="modal-content">
                <span class="close" id="closeThumbnailModal">&times;</span>
                <h3>📐 Edit Thumbnail Position</h3>
                <p>Click on the image where you want the thumbnail to be centered:</p>
                
                <div class="thumbnail-editor-layout">
                    <div class="thumbnail-picker-container">
                        <img id="thumbnailPickerImage" class="thumbnail-picker-image" src="" alt="">
                        <div id="cropRectangle" class="crop-rectangle" style="display: none;"></div>
                        <div id="dragCenterPoint" class="drag-center-point" style="display: none;"></div>
                    </div>
                </div>
                
                <div class="thumbnail-modal-buttons">
                    <button class="btn" id="saveThumbnailPosition">Save Position</button>
                    <button class="btn btn-secondary" id="resetThumbnailPosition">Reset to Top</button>
                    <button class="btn btn-secondary" id="cancelThumbnailEdit">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', thumbnailModalHtml);
    
    setupThumbnailEventListeners();
    
    // Make openThumbnailEditor globally available
    window.openThumbnailEditor = openThumbnailEditor;
}

// Setup event listeners for thumbnail editor
function setupThumbnailEventListeners() {
    // Get elements
    const thumbnailModal = document.getElementById('thumbnailModal');
    const closeThumbnailModal = document.getElementById('closeThumbnailModal');
    const thumbnailPickerImage = document.getElementById('thumbnailPickerImage');
    const cropRectangle = document.getElementById('cropRectangle');
    const dragCenterPoint = document.getElementById('dragCenterPoint');
    const saveThumbnailPosition = document.getElementById('saveThumbnailPosition');
    const resetThumbnailPosition = document.getElementById('resetThumbnailPosition');
    const cancelThumbnailEdit = document.getElementById('cancelThumbnailEdit');
    
    // Close modal events
    closeThumbnailModal.addEventListener('click', () => thumbnailModal.style.display = 'none');
    cancelThumbnailEdit.addEventListener('click', () => thumbnailModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === thumbnailModal) thumbnailModal.style.display = 'none';
    });
    
    // Image click to set position (fallback method)
    thumbnailPickerImage.addEventListener('click', (e) => {
        if (isDragging) return; // Don't handle clicks during drag
        
        const rect = thumbnailPickerImage.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        currentPosition = { x: Math.round(x), y: Math.round(y) };
        updateCropRectangle();
        console.log(`Position updated to: ${currentPosition.x}% ${currentPosition.y}%`);
    });
    
    // Dragging functionality for center point
    dragCenterPoint.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragCenterPoint.classList.add('dragging');
        
        const rect = thumbnailPickerImage.getBoundingClientRect();
        dragOffset.x = e.clientX - (rect.left + (rect.width * currentPosition.x / 100));
        dragOffset.y = e.clientY - (rect.top + (rect.height * currentPosition.y / 100));
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const rect = thumbnailPickerImage.getBoundingClientRect();
        const x = ((e.clientX - dragOffset.x - rect.left) / rect.width) * 100;
        const y = ((e.clientY - dragOffset.y - rect.top) / rect.height) * 100;
        
        // Constrain to image boundaries
        currentPosition.x = Math.max(0, Math.min(100, Math.round(x)));
        currentPosition.y = Math.max(0, Math.min(100, Math.round(y)));
        
        updateCropRectangle();
        e.preventDefault();
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            dragCenterPoint.classList.remove('dragging');
            console.log(`Final position: ${currentPosition.x}% ${currentPosition.y}%`);
        }
    });
    
    // Handle image load to get natural dimensions and update crop rectangle
    thumbnailPickerImage.addEventListener('load', () => {
        imageNaturalDimensions.width = thumbnailPickerImage.naturalWidth;
        imageNaturalDimensions.height = thumbnailPickerImage.naturalHeight;
        
        // Update crop rectangle after image loads
        setTimeout(updateCropRectangle, 100);
    });
    
    // Reset to top (TOP-ALIGNED: 25% from top instead of center)
    resetThumbnailPosition.addEventListener('click', () => {
        currentPosition = { x: 50, y: 25 }; // TOP-ALIGNED default
        updateCropRectangle();
        console.log('Position reset to top: 50% 25%');
    });
    
    // Save position
    saveThumbnailPosition.addEventListener('click', saveThumbnailPositionHandler);
}

// Update crop rectangle and center point display
function updateCropRectangle() {
    const thumbnailPickerImage = document.getElementById('thumbnailPickerImage');
    const cropRectangle = document.getElementById('cropRectangle');
    const dragCenterPoint = document.getElementById('dragCenterPoint');
    
    const rect = thumbnailPickerImage.getBoundingClientRect();
    const containerRect = thumbnailPickerImage.parentElement.getBoundingClientRect();
    
    // Calculate relative position within the container
    const relativeLeft = rect.left - containerRect.left;
    const relativeTop = rect.top - containerRect.top;
    
    // Calculate crop area (300x200 to match thumbnail card size)
    const cropWidth = Math.min(300, rect.width);
    const cropHeight = Math.min(200, rect.height);
    
    // Calculate center position based on current x,y percentages
    const centerX = relativeLeft + (rect.width * currentPosition.x / 100);
    const centerY = relativeTop + (rect.height * currentPosition.y / 100);
    
    // Position crop rectangle around center point
    const cropLeft = Math.max(relativeLeft, Math.min(relativeLeft + rect.width - cropWidth, centerX - cropWidth / 2));
    const cropTop = Math.max(relativeTop, Math.min(relativeTop + rect.height - cropHeight, centerY - cropHeight / 2));
    
    cropRectangle.style.left = `${cropLeft}px`;
    cropRectangle.style.top = `${cropTop}px`;
    cropRectangle.style.width = `${cropWidth}px`;
    cropRectangle.style.height = `${cropHeight}px`;
    cropRectangle.style.display = 'block';
    
    // Position center point
    dragCenterPoint.style.left = `${centerX}px`;
    dragCenterPoint.style.top = `${centerY}px`;
    dragCenterPoint.style.display = 'block';
}

// Save thumbnail position handler
async function saveThumbnailPositionHandler() {
    if (thumbnailEditImageId) {
        try {
            await database.updateMedia(thumbnailEditImageId, {
                thumbnailPosition: currentPosition
            });
            
            // Close modal
            document.getElementById('thumbnailModal').style.display = 'none';
            
            // Trigger reload in main app
            window.dispatchEvent(new CustomEvent('mediaUpdated'));
            
            showNotification('Thumbnail position updated successfully!', 'success');
            console.log(`Thumbnail position updated for image ${thumbnailEditImageId}:`, currentPosition);
        } catch (error) {
            console.error('Error updating thumbnail position:', error);
            showNotification('Error updating thumbnail position: ' + error.message, 'error');
        }
    }
}

// Open thumbnail editor (called from gallery cards)
async function openThumbnailEditor(itemId, event) {
    // Stop the click event from bubbling up to the image card
    if (event) {
        event.stopPropagation();
    }
    
    thumbnailEditImageId = itemId;
    const item = await database.getMediaById(itemId);
    
    if (item) {
        // Use thumbnail data for editing (for videos, this is the generated thumbnail)
        const editImage = item.thumbnailData || item.imageData;
        
        // Set up modal with image
        const thumbnailPickerImage = document.getElementById('thumbnailPickerImage');
        thumbnailPickerImage.src = editImage;
        
        // Set current position (TOP-ALIGNED default if none exists)
        if (item.thumbnailPosition) {
            currentPosition = { ...item.thumbnailPosition };
            console.log(`Initial position: ${currentPosition.x}% ${currentPosition.y}%`);
        } else {
            currentPosition = { x: 50, y: 25 }; // TOP-ALIGNED default
            console.log('Initial position: 50% 25% (TOP-ALIGNED default)');
        }
        
        // Hide elements initially (will show after image loads)
        const cropRectangle = document.getElementById('cropRectangle');
        const dragCenterPoint = document.getElementById('dragCenterPoint');
        cropRectangle.style.display = 'none';
        dragCenterPoint.style.display = 'none';
        
        // Show modal
        const thumbnailModal = document.getElementById('thumbnailModal');
        thumbnailModal.style.display = 'block';
    }
}