// ============ ENHANCED SHOP SYSTEM ============

const EnhancedShop = {
    // Items purchasable with in-game coins
    coinItems: {
        shuffle: { name: 'Shuffle', price: 50, icon: '🔀', type: 'powerup' },
        hammer: { name: 'Hammer', price: 75, icon: '🔨', type: 'powerup' },
        double: { name: '2x Score', price: 100, icon: '✨', type: 'powerup' },
        shield: { name: 'Shield', price: 80, icon: '🛡️', type: 'powerup' }
    },
    
    // Coin packs purchasable with Telegram Stars
    starItems: {
        pack100: { coins: 100, stars: 50, icon: '🪙', name: '100 Coins' },
        pack500: { coins: 500, stars: 200, icon: '💰', name: '500 Coins' },
        pack1000: { coins: 1000, stars: 350, icon: '💎', name: '1000 Coins' },
        pack2500: { coins: 2500, stars: 800, icon: '👑', name: '2500 Coins' }
    },
    
    async buyWithCoins(itemType) {
        const item = this.coinItems[itemType];
        if (!item) return;
        
        if (typeof coins !== 'undefined' && coins >= item.price) {
            // Use existing in-game coin system
            spendCoins(item.price);
            
            if (item.type === 'powerup') {
                powerUps[itemType]++;
                updatePowerUpUI();
            }
            
            updateCoinsDisplay();
            playSound('powerup');
            TelegramIntegration.hapticFeedback('success');
            
            // Save to cloud and server
            await this.syncToCloud();
            
            showToast(`Purchased ${item.name}!`);
        } else {
            // Offer to buy with stars
            this.showInsufficientCoinsModal(itemType);
        }
    },
    
    async buyWithStars(itemType) {
        const item = this.starItems[itemType];
        if (!item) return;
        
        if (!TelegramIntegration.isTelegramEnvironment) {
            showToast('Star payments only available in Telegram');
            return;
        }
        
        try {
            showLoading('Processing payment...');
            
            // Create invoice for Telegram Stars
            const payload = JSON.stringify({
                type: 'coin_pack',
                itemType: itemType,
                coins: item.coins,
                userId: TelegramIntegration.getUserId(),
                timestamp: Date.now()
            });
            
            const invoice = await PaymentSystem.createInvoice(
                item.stars,
                `${item.coins} Coins for 2048 Master`,
                payload
            );
            
            // Open Telegram invoice
            const result = await PaymentSystem.openInvoice(invoice.invoice_link);
            
            if (result.success && result.status === 'paid') {
                // Payment successful
                addCoins(item.coins);
                await this.syncToCloud();
                
                hideLoading();
                TelegramIntegration.hapticFeedback('success');
                showToast(`Successfully purchased ${item.coins} coins!`);
                
                // Update UI
                updateCoinsDisplay();
                updateShopButtons();
                
                // Record transaction
                await this.recordTransaction({
                    type: 'star_purchase',
                    itemType: itemType,
                    coins: item.coins,
                    stars: item.stars,
                    timestamp: Date.now()
                });
            } else if (result.status === 'cancelled') {
                hideLoading();
                showToast('Payment cancelled');
            } else {
                hideLoading();
                showToast('Payment failed');
            }
        } catch (error) {
            hideLoading();
            console.error('Payment error:', error);
            TelegramIntegration.hapticFeedback('error');
            showToast('Payment error: ' + error.message);
        }
    },
    
    showInsufficientCoinsModal(itemType) {
        const item = this.coinItems[itemType];
        const modal = document.createElement('div');
        modal.className = 'modal-overlay show';
        modal.innerHTML = `
            <div class="modal">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                <h2>Insufficient Coins</h2>
                <div class="modal-content">
                    <p>You don't have enough coins for ${item.name}.</p>
                    <p>You have: <strong>${coins} 🪙</strong></p>
                    <p>Required: <strong>${item.price} 🪙</strong></p>
                    
                    ${TelegramIntegration.isTelegramEnvironment ? `
                        <h3>Buy Coins with Stars:</h3>
                        ${Object.entries(this.starItems).map(([key, starItem]) => `
                            <div class="shop-item" onclick="EnhancedShop.buyWithStars('${key}')" style="cursor:pointer;">
                                <div class="shop-icon">${starItem.icon}</div>
                                <div class="shop-info">
                                    <div class="shop-name">${starItem.name}</div>
                                    <div class="shop-price">⭐ ${starItem.stars} stars</div>
                                </div>
                                <button class="shop-buy-btn">Buy</button>
                            </div>
                        `).join('')}
                    ` : `
                        <p style="color:#ff4757;">Star payments are only available in Telegram.</p>
                        <p>Open this app in Telegram to purchase coins with stars.</p>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    async syncToCloud() {
        const gameData = {
            coins: coins,
            powerUps: powerUps,
            bestScore: bestScore,
            achievements: achievements,
            gamesPlayed: gamesPlayed,
            totalMerges: totalMerges,
            bestTileEver: bestTileEver,
            timestamp: Date.now()
        };
        
        // Save to Telegram Cloud
        if (TelegramIntegration.isTelegramEnvironment) {
            await TelegramIntegration.saveToCloud('gameData', gameData);
        }
        
        // Save to Supabase via server
        try {
            await PaymentSystem.syncGameData(gameData);
        } catch (error) {
            console.error('Server sync failed:', error);
        }
    },
    
    async loadFromCloud() {
        // Load from Telegram Cloud first
        if (TelegramIntegration.isTelegramEnvironment) {
            const cloudData = await TelegramIntegration.loadFromCloud('gameData');
            if (cloudData) {
                this.applyGameData(cloudData);
                return;
            }
        }
        
        // Load from server
        try {
            const serverData = await PaymentSystem.getGameData();
            if (serverData && serverData.gameData) {
                this.applyGameData(serverData.gameData);
            }
        } catch (error) {
            console.error('Server data load failed:', error);
        }
    },
    
    applyGameData(gameData) {
        if (!gameData) return;
        
        coins = gameData.coins || coins;
        powerUps = { ...powerUps, ...gameData.powerUps };
        bestScore = gameData.bestScore || bestScore;
        achievements = gameData.achievements || achievements;
        gamesPlayed = gameData.gamesPlayed || gamesPlayed;
        totalMerges = gameData.totalMerges || totalMerges;
        bestTileEver = gameData.bestTileEver || bestTileEver;
        
        // Save to localStorage
        localStorage.setItem('coins2048', coins);
        localStorage.setItem('bestScore2048Master', bestScore);
        localStorage.setItem('achievements2048', JSON.stringify(achievements));
        localStorage.setItem('gamesPlayed2048', gamesPlayed);
        localStorage.setItem('totalMerges2048', totalMerges);
        localStorage.setItem('bestTileEver2048', bestTileEver);
        
        // Update UI
        updateCoinsDisplay();
        updatePowerUpUI();
        updateBestScore();
    },
    
    async recordTransaction(transaction) {
        try {
            await PaymentSystem.recordTransaction(transaction);
        } catch (error) {
            console.error('Failed to record transaction:', error);
        }
    }
};

// UI Helper functions
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (overlay) {
        loadingText.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--accent);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 4000;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Make EnhancedShop globally accessible
window.EnhancedShop = EnhancedShop;
window.PaymentSystem = PaymentSystem;
window.TelegramIntegration = TelegramIntegration;