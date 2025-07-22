// modal.js - Handles image/video modal display and interactions

import { database } from './database.js';
import { displayOrganizedMetadata } from './metadata.js';
import { showNotification, downloadBlob, generateSafeFilename } from './utils.js';

let currentImageId = null;
let currentImageData = null;

// Open image/video modal
export function openImageModal(item, autoplay = false) {
    currentImageId = item.id;
    currentImageData = item;
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalVideo = document.getElementById('modalVideo');
    const downloadWorkflow = document.getElementById('downloadWorkflow');
    
    const isVideo = item.mediaType === 'video';
    
    if (isVideo) {
        // Show video, hide image
        modalImage.style.display = 'none';
        modalVideo.style.display = 'block';
        modalVideo.src = item.imageData;
        
        if (autoplay) {
            modalVideo.play();
        }
    } else {
        // Show image, hide video
        modalVideo.style.display = 'none';
        modalImage.style.display = 'block';
        modalImage.src = item.imageData;
    }
    
    // Populate form fields
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
    
    modal.style.display = 'block';
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
        closeModal();
        
        // Trigger reload in main app
        window.dispatchEvent(new CustomEvent('mediaUpdated'));
        
        showNotification('Changes saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving metadata:', error);
        showNotification('Error saving changes: ' + error.message, 'error');
    }
}

// Delete current item (works for both images and videos)
export async function deleteCurrentImage() {
    if (!currentImageId) return;
    
    const mediaType = currentImageData.mediaType === 'video' ? 'video' : 'image';
    
    if (confirm(`Are you sure you want to delete this ${mediaType}?`)) {
        try {
            await database.deleteMedia(currentImageId);
            closeModal();
            
            // Trigger reload in main app
            window.dispatchEvent(new CustomEvent('mediaUpdated'));
            
            showNotification(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} deleted successfully!`, 'success');
        } catch (error) {
            console.error('Error deleting media:', error);
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
    
    // Stop any playing video
    const modalVideo = document.getElementById('modalVideo');
    if (modalVideo) {
        modalVideo.pause();
        modalVideo.src = '';
    }
    
    currentImageId = null;
    currentImageData = null;
}

// Setup modal event listeners
export function setupModalEventListeners() {
    const modal = document.getElementById('imageModal');
    const closeModalBtn = document.getElementById('closeModal');
    const saveMetadata = document.getElementById('saveMetadata');
    const deleteImage = document.getElementById('deleteImage');
    const downloadWorkflow = document.getElementById('downloadWorkflow');

    // Modal events
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Save and delete buttons
    saveMetadata.addEventListener('click', saveImageMetadata);
    deleteImage.addEventListener('click', deleteCurrentImage);
    
    // Download workflow button
    downloadWorkflow.addEventListener('click', downloadCurrentWorkflow);
}

// Get current image data (for other modules)
export function getCurrentImageData() {
    return currentImageData;
}

// Get current image ID (for other modules)
export function getCurrentImageId() {
    return currentImageId;
}