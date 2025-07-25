// minigallery.js - Handles mini-gallery functionality within the modal

import { database } from './database.js';
import { displayOrganizedMetadata } from './metadata.js';
import { showNotification } from './utils.js';

let currentImageId = null;
let currentImageData = null;
let relatedImages = [];

// Load mini-gallery with related images
export async function loadMiniGallery(item) {
    const miniGalleryStrip = document.getElementById('miniGalleryStrip');
    const miniGalleryThumbnails = document.getElementById('miniGalleryThumbnails');
    
    // Reset mini-gallery
    miniGalleryThumbnails.innerHTML = '';
    miniGalleryStrip.style.display = 'none';
    
    // Only show mini-gallery for images with a gallery_id > 0
    if (item.mediaType === 'video' || !item.galleryId || item.galleryId === 0) {
        return;
    }
    
    try {
        // Get related images from the same gallery
        relatedImages = await database.getMediaByGalleryId(item.galleryId);
        
        // Filter to only show images (no videos)
        relatedImages = relatedImages.filter(img => img.mediaType === 'image');
        
        // Show mini-gallery if there are related images
        if (relatedImages.length > 0) {
            // Sort the images to ensure the MAIN image (lowest ID) is always first
            const sortedImages = [...relatedImages];
            // Sort by ID to put the main image (lowest ID) first, then others in order
            sortedImages.sort((a, b) => a.id - b.id);
            
            // Update the relatedImages array with the sorted version
            relatedImages = sortedImages;
            
            // Create thumbnails for each related image
            relatedImages.forEach((img) => {
                const thumbnail = document.createElement('img');
                thumbnail.className = 'mini-gallery-thumbnail';
                thumbnail.src = img.serverPath ? `${img.serverPath}` : '';
                thumbnail.alt = img.title || 'Untitled';
                thumbnail.title = img.title || 'Untitled';
                
                // Highlight the current image (wherever it is in the sorted order)
                if (img.id === item.id) {
                    thumbnail.classList.add('active');
                }
                
                // Add click handler to switch images
                thumbnail.addEventListener('click', () => {
                    switchToImage(img);
                });
                
                miniGalleryThumbnails.appendChild(thumbnail);
            });
            
            miniGalleryStrip.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading mini-gallery:', error);
    }
}

// Switch to a different image in the modal
export function switchToImage(item) {
    currentImageId = item.id;
    currentImageData = item;
    
    const modalPreviewImg = document.getElementById('modalPreviewImg');
    const modalPreviewVideo = document.getElementById('modalPreviewVideo');
    const modalMediaTitle = document.getElementById('modalMediaTitle');
    const videoControls = document.getElementById('modalVideoControls');
    const downloadWorkflow = document.getElementById('downloadWorkflow');
    const addToGalleryBtn = document.getElementById('addToGallery');
    
    const isVideo = item.mediaType === 'video';
    
    // Update media preview
    if (isVideo) {
        // Show video, hide image
        modalPreviewImg.style.display = 'none';
        modalPreviewVideo.style.display = 'block';
        videoControls.style.display = 'flex';
        
        // Set video source and attributes
        modalPreviewVideo.src = item.serverPath ? `${item.serverPath}` : '';
    } else {
        // Show image, hide video
        modalPreviewVideo.style.display = 'none';
        videoControls.style.display = 'none';
        modalPreviewImg.style.display = 'block';
        modalPreviewImg.src = item.serverPath ? `${item.serverPath}` : '';
    }
    
    // Update title
    modalMediaTitle.textContent = item.title || 'Untitled';
    
    // Update form fields
    document.getElementById('imageTitle').value = item.title || '';
    document.getElementById('imagePrompt').value = item.prompt || '';
    document.getElementById('imageModel').value = item.model || '';
    document.getElementById('imageTags').value = item.tags || '';
    document.getElementById('imageNotes').value = item.notes || '';
    
    // Update workflow download button
    const hasWorkflow = !isVideo && item.metadata && (item.metadata.workflow || item.metadata.prompt);
    if (hasWorkflow) {
        downloadWorkflow.style.display = 'inline-block';
    } else {
        downloadWorkflow.style.display = 'none';
    }
    
    // Update "Add to Gallery" button visibility - always show for images
    if (!isVideo) {
        addToGalleryBtn.style.display = 'inline-block';
    } else {
        addToGalleryBtn.style.display = 'none';
    }
    
    // Update metadata display
    displayOrganizedMetadata(item.metadata, isVideo);
    
    // Update mini-gallery active state
    updateMiniGalleryActiveState(item.id);
    
    // Return the updated item data
    return item;
}

// Update active state in mini-gallery
export function updateMiniGalleryActiveState(activeId) {
    const thumbnails = document.querySelectorAll('.mini-gallery-thumbnail');
    thumbnails.forEach((thumbnail, index) => {
        const img = relatedImages[index];
        if (img && img.id === activeId) {
            thumbnail.classList.add('active');
        } else {
            thumbnail.classList.remove('active');
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

// Remove an image from the mini-gallery view (after deletion)
export function removeImageFromView(imageId) {
    // Remove the image from the relatedImages array
    relatedImages = relatedImages.filter(img => img.id !== imageId);
    
    // Reload the mini-gallery
    if (currentImageData) {
        loadMiniGallery(currentImageData);
    }
    
    // If no images left, hide the mini-gallery strip
    const miniGalleryStrip = document.getElementById('miniGalleryStrip');
    if (relatedImages.length === 0 && miniGalleryStrip) {
        miniGalleryStrip.style.display = 'none';
    }
}

// Check if current image is part of a gallery
export function isCurrentImageInGallery() {
    return currentImageData && currentImageData.galleryId && currentImageData.galleryId > 0;
}

// Get related images
export function getRelatedImages() {
    return relatedImages;
}
