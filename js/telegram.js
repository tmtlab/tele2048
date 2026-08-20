// ============ TELEGRAM MINI APP INTEGRATION ============

const TelegramIntegration = {
    tg: null,
    user: null,
    isTelegramEnvironment: false,
    initData: null,
    startParam: null,
    
    initialize() {
        if (window.Telegram?.WebApp) {
            this.tg = window.Telegram.WebApp;
            this.isTelegramEnvironment = true;
            this.initData = this.tg.initData;
            this.startParam = this.tg.initDataUnsafe?.start_param || null;
            
            // Get user data
            this.user = this.tg.initDataUnsafe?.user || null;
            
            // Initialize the app
            this.tg.ready();
            this.tg.expand();
            
            // Set theme colors
            this.applyTelegramTheme();
            
            // Listen for theme changes
            this.tg.onEvent('themeChanged', () => {
                this.applyTelegramTheme();
            });
            
            // Listen for viewport changes
            this.tg.onEvent('viewportChanged', ({ isStateStable }) => {
                if (isStateStable) {
                    this.handleViewportChange();
                }
            });
            
            console.log('Telegram Mini App initialized');
        } else {
            console.log('Running outside Telegram environment');
        }
    },
    
    applyTelegramTheme() {
        if (!this.tg?.themeParams) return;
        
        const theme = this.tg.themeParams;
        document.documentElement.style.setProperty('--bg-primary', theme.bg_color || '#faf8ef');
        document.documentElement.style.setProperty('--text-primary', theme.text_color || '#776e65');
        document.documentElement.style.setProperty('--accent', theme.button_color || '#8f7a66');
        document.documentElement.style.setProperty('--board-bg', theme.secondary_bg_color || '#bbada0');
        document.documentElement.style.setProperty('--text-secondary', theme.hint_color || '#999');
        
        // Set theme mode
        const isDark = theme.bg_color && this.isColorDark(theme.bg_color);
        document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    },
    
    isColorDark(hexColor) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128;
    },
    
    handleViewportChange() {
        // Adjust layout for viewport changes
        const viewportHeight = this.tg.viewportHeight;
        document.body.style.height = viewportHeight + 'px';
    },
    
    getUserId() {
        return this.user?.id || 'anonymous';
    },
    
    getUserName() {
        return this.user?.first_name || this.user?.username || 'You';
    },
    
    getUserPhoto() {
        return this.user?.photo_url || null;
    },
    
    getLanguageCode() {
        return this.user?.language_code || 'en';
    },
    
    isPremiumUser() {
        return this.user?.is_premium || false;
    },
    
    // Cloud storage for cross-device sync
    async saveToCloud(key, value) {
        if (!this.tg?.CloudStorage) return false;
        
        try {
            await new Promise((resolve, reject) => {
                this.tg.CloudStorage.setItem(key, JSON.stringify(value), (error, success) => {
                    if (success) resolve();
                    else reject(error || new Error('Cloud save failed'));
                });
            });
            return true;
        } catch (error) {
            console.error('Cloud save failed:', error);
            return false;
        }
    },
    
    async loadFromCloud(key) {
        if (!this.tg?.CloudStorage) return null;
        
        try {
            return await new Promise((resolve, reject) => {
                this.tg.CloudStorage.getItem(key, (error, value) => {
                    if (error) reject(error);
                    else resolve(value ? JSON.parse(value) : null);
                });
            });
        } catch (error) {
            console.error('Cloud load failed:', error);
            return null;
        }
    },
    
    async removeFromCloud(key) {
        if (!this.tg?.CloudStorage) return false;
        
        try {
            await new Promise((resolve, reject) => {
                this.tg.CloudStorage.removeItem(key, (error, success) => {
                    if (success) resolve();
                    else reject(error || new Error('Cloud remove failed'));
                });
            });
            return true;
        } catch (error) {
            console.error('Cloud remove failed:', error);
            return false;
        }
    },
    
    // Haptic feedback
    hapticFeedback(type = 'light') {
        if (!this.tg?.HapticFeedback) return;
        
        switch(type) {
            case 'light':
                this.tg.HapticFeedback.impactOccurred('light');
                break;
            case 'medium':
                this.tg.HapticFeedback.impactOccurred('medium');
                break;
            case 'heavy':
                this.tg.HapticFeedback.impactOccurred('heavy');
                break;
            case 'success':
                this.tg.HapticFeedback.notificationOccurred('success');
                break;
            case 'warning':
                this.tg.HapticFeedback.notificationOccurred('warning');
                break;
            case 'error':
                this.tg.HapticFeedback.notificationOccurred('error');
                break;
        }
    },
    
    // Show popup
    showPopup(title, message, buttons = [{type: 'ok'}]) {
        if (!this.tg) return;
        
        return new Promise((resolve) => {
            this.tg.showPopup({
                title: title,
                message: message,
                buttons: buttons
            }, (buttonId) => {
                resolve(buttonId);
            });
        });
    },
    
    // Show alert
    showAlert(message) {
        if (!this.tg) {
            alert(message);
            return;
        }
        
        this.tg.showAlert(message);
    },
    
    // Show confirm
    showConfirm(message) {
        if (!this.tg) {
            return Promise.resolve(confirm(message));
        }
        
        return new Promise((resolve) => {
            this.tg.showConfirm(message, (confirmed) => {
                resolve(confirmed);
            });
        });
    },
    
    // Get init data for server validation
    getInitData() {
        return this.initData || '';
    },
    
    // Check if running in Telegram
    isInTelegram() {
        return this.isTelegramEnvironment;
    },
    
    // Get safe area insets
    getSafeAreaInsets() {
        if (!this.tg) return { top: 0, bottom: 0, left: 0, right: 0 };
        
        return {
            top: this.tg.safeAreaInset?.top || 0,
            bottom: this.tg.safeAreaInset?.bottom || 0,
            left: this.tg.safeAreaInset?.left || 0,
            right: this.tg.safeAreaInset?.right || 0
        };
    },
    
    // Set background color
    setBackgroundColor(color) {
        if (this.tg?.setBackgroundColor) {
            this.tg.setBackgroundColor(color);
        }
    },
    
    // Set header color
    setHeaderColor(color) {
        if (this.tg?.setHeaderColor) {
            this.tg.setHeaderColor(color);
        }
    },
    
    // Set bottom bar color
    setBottomBarColor(color) {
        if (this.tg?.setBottomBarColor) {
            this.tg.setBottomBarColor(color);
        }
    },
    
    // Disable vertical swipes
    disableVerticalSwipes() {
        if (this.tg?.disableVerticalSwipes) {
            this.tg.disableVerticalSwipes();
        }
    },
    
    // Enable vertical swipes
    enableVerticalSwipes() {
        if (this.tg?.enableVerticalSwipes) {
            this.tg.enableVerticalSwipes();
        }
    },
    
    // Open link
    openLink(url) {
        if (this.tg?.openLink) {
            this.tg.openLink(url);
        } else {
            window.open(url, '_blank');
        }
    },
    
    // Open Telegram link
    openTelegramLink(url) {
        if (this.tg?.openTelegramLink) {
            this.tg.openTelegramLink(url);
        } else {
            window.open(url, '_blank');
        }
    },
    
    // Share to story
    shareToStory(mediaUrl, text) {
        if (this.tg?.shareToStory) {
            this.tg.shareToStory(mediaUrl, {
                text: text || 'Check out my 2048 score!'
            });
        }
    }
};

// Initialize Telegram integration
TelegramIntegration.initialize();