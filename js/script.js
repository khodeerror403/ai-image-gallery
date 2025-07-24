// script.js - Main application entry point (v3.0 - SQLite)

// Import all modules (keeping existing structure)
import { database } from './database.js';  // ← Fixed import path
import { handleFileSelect, handleFileDrop } from './mediaProcessor.js';
import { displayImages, updateStats, setAllImages } from './gallery.js';
import { setupModalEventListeners } from './modal.js';
import { setupThumbnailPositionPicker } from './thumbnailEditor.js';
import { addThumbnailGenerationControls } from './thumbnailGenerator.js';
import { debounce, showNotification, downloadBlob, generateSafeFilename } from './utils.js';
import { updateAllPrompts } from './updatePrompts.js';

// Initialize the app
async function init() {
    console.log('🚀 Initializing AI Media Gallery v3.0');
    
    try {
        await loadImages();
        await updateStatsDisplay();
        setupEventListeners();
        setupModalEventListeners();
        setupThumbnailPositionPicker();
        addThumbnailGenerationControls();
        setupHamburgerMenu(); // Add hamburger menu functionality
        
        console.log('✅ App initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing app:', error);
        showNotification('Error initializing app: ' + error.message, 'error');
    }
}

// Load all images and display them
async function loadImages() {
    try {
        const allImages = await database.loadAllMedia();
        setAllImages(allImages);
        displayImages(allImages);
    } catch (error) {
        console.error('Error loading images:', error);
        showNotification('Error loading media: ' + error.message, 'error');
    }
}

// Update stats display
async function updateStatsDisplay() {
    try {
        const stats = await database.getStats();
        updateStats(stats);
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Setup main event listeners
function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const searchBox = document.getElementById('searchBox');

    // Upload area click
    uploadArea.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target, database, async () => {
            await loadImages();
            await updateStatsDisplay();
        });
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        uploadArea.classList.remove('dragover');
        handleFileDrop(e, database, async () => {
            await loadImages();
            await updateStatsDisplay();
        });
    });

    // Search functionality with debounce
    const debouncedSearch = debounce(handleSearch, 300);
    searchBox.addEventListener('input', debouncedSearch);
    
    // Listen for media updates from other modules
    window.addEventListener('mediaUpdated', async () => {
        await loadImages();
        await updateStatsDisplay();
    });
}

// Setup hamburger menu functionality
function setupHamburgerMenu() {
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const toolsMenu = document.getElementById('toolsMenu');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.createElement('div');
    menuOverlay.className = 'menu-overlay';
    document.body.appendChild(menuOverlay);
    
    // Add event listeners for menu buttons
    const exportData = document.getElementById('exportData');
    const importData = document.getElementById('importData');
    const clearAllData = document.getElementById('clearAllData');
    const importFile = document.getElementById('importFile');
    
    // Export/Import buttons
    exportData.addEventListener('click', exportAllData);
    importData.addEventListener('click', () => {
        importFile.click();
        closeToolsMenu(); // Close menu after clicking
    });
    importFile.addEventListener('change', (e) => {
        importAllData(e);
        closeToolsMenu(); // Close menu after selecting file
    });
    
    // Clear all data button
    clearAllData.addEventListener('click', () => {
        closeToolsMenu(); // Close menu before showing confirmation
        setTimeout(() => clearAllDataHandler(), 100); // Small delay to ensure menu closes
    });
    
    // Hamburger menu toggle
    hamburgerMenu.addEventListener('click', toggleToolsMenu);
    
    // Close menu button
    closeMenuBtn.addEventListener('click', closeToolsMenu);
    
    // Close menu when clicking overlay
    menuOverlay.addEventListener('click', closeToolsMenu);
    
    // Close menu when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toolsMenu.classList.contains('active')) {
            closeToolsMenu();
        }
    });
}

// Toggle tools menu
function toggleToolsMenu() {
    const toolsMenu = document.getElementById('toolsMenu');
    const menuOverlay = document.querySelector('.menu-overlay');
    
    if (toolsMenu.classList.contains('active')) {
        closeToolsMenu();
    } else {
        openToolsMenu();
    }
}

// Open tools menu
function openToolsMenu() {
    const toolsMenu = document.getElementById('toolsMenu');
    const menuOverlay = document.querySelector('.menu-overlay');
    
    toolsMenu.classList.add('active');
    menuOverlay.classList.add('active');
    
    // Prevent body scroll when menu is open
    document.body.style.overflow = 'hidden';
}

// Close tools menu
function closeToolsMenu() {
    const toolsMenu = document.getElementById('toolsMenu');
    const menuOverlay = document.querySelector('.menu-overlay');
    
    toolsMenu.classList.remove('active');
    menuOverlay.classList.remove('active');
    
    // Restore body scroll
    document.body.style.overflow = '';
}

// Handle search with debouncing
async function handleSearch(e) {
    try {
        const searchTerm = e.target.value;
        const results = await database.searchMedia(searchTerm);
        setAllImages(results);
        displayImages(results);
    } catch (error) {
        console.error('Error searching:', error);
        showNotification('Error searching media: ' + error.message, 'error');
    }
}

// Export all data to JSON file
async function exportAllData() {
    try {
        const exportData = await database.exportAllData();
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const filename = generateSafeFilename('ai-media-gallery-backup', '') + '.json';
        
        downloadBlob(blob, filename);
        
        const { images: imageCount = 0, videos: videoCount = 0 } = await database.getStats();
        showNotification(`Exported ${exportData.totalItems} items to backup file!\n(${imageCount} images, ${videoCount} videos)`, 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('Error exporting data: ' + error.message, 'error');
    }
}

// Import data from JSON file
async function importAllData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (importData.images && Array.isArray(importData.images)) {
            const results = await database.addMultipleMedia(importData.images);
            
            await loadImages();
            await updateStatsDisplay();
            
            showNotification(`Imported ${importData.images.length} items successfully!`, 'success');
        } else {
            showNotification('Invalid backup file format!', 'error');
        }
    } catch (error) {
        console.error('Error importing file:', error);
        showNotification('Error importing file: ' + error.message, 'error');
    }
    
    // Reset file input
    e.target.value = '';
}

// Clear all data handler
async function clearAllDataHandler() {
    if (confirm('⚠️ WARNING: This will permanently delete ALL images, videos, and database records!\n\nAre you sure you want to proceed?')) {
        const clearAllDataBtn = document.getElementById('clearAllData');
        clearAllDataBtn.disabled = true;
        clearAllDataBtn.textContent = 'Clearing...';
        
        try {
            // Make API call to clear all data
            const response = await fetch('/api/clear-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification(`✅ Cleared all data successfully!\n- ${result.databaseRecordsDeleted} database records deleted\n- ${result.filesDeleted} files deleted\n- ${result.fileErrors} file errors`, 'success');
                // Reload images to show empty gallery
                await loadImages();
                await updateStatsDisplay();
            } else {
                showNotification(`❌ Failed to clear data: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Clear all data failed:', error);
            showNotification('Error during clear all data: ' + error.message, 'error');
        } finally {
            clearAllDataBtn.disabled = false;
            clearAllDataBtn.textContent = 'Clear All Data';
        }
    }
}

// Update all prompts handler
async function updateAllPromptsHandler() {
    if (confirm('Update all prompts in the database? This may take a while.')) {
        const updatePromptsBtn = document.getElementById('updatePrompts');
        updatePromptsBtn.disabled = true;
        updatePromptsBtn.textContent = 'Updating...';
        
        try {
            const results = await updateAllPrompts();
            
            if (results.processed > 0) {
                showNotification(`Updated ${results.processed} prompts successfully! (${results.skipped} unchanged, ${results.errors} errors)`, 'success');
                // Reload images to show updated prompts
                await loadImages();
                await updateStatsDisplay();
            } else if (results.skipped > 0 && results.errors === 0) {
                showNotification(`All prompts are already up to date (${results.skipped} items checked)`, 'info');
            } else if (results.errors > 0) {
                showNotification(`Prompt update failed for ${results.errors} items`, 'error');
            }
        } catch (error) {
            console.error('Prompt update failed:', error);
            showNotification('Error during prompt update: ' + error.message, 'error');
        } finally {
            updatePromptsBtn.disabled = false;
            updatePromptsBtn.textContent = 'Update Prompts';
        }
    }
}

// Start the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
