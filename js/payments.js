// ============ PAYMENT SYSTEM ============

const PaymentSystem = {
    API_ENDPOINT: '/api', // Vercel API routes
    
    async createInvoice(amount, description, payload) {
        if (!TelegramIntegration.isTelegramEnvironment) {
            throw new Error('Not in Telegram environment');
        }
        
        const response = await fetch(`${this.API_ENDPOINT}/create-invoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                initData: TelegramIntegration.getInitData(),
                amount: amount,
                description: description,
                payload: payload
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create invoice');
        }
        
        return await response.json();
    },
    
    async openInvoice(invoiceLink) {
        if (!TelegramIntegration.tg) {
            throw new Error('Telegram not initialized');
        }
        
        return new Promise((resolve, reject) => {
            TelegramIntegration.tg.openInvoice(invoiceLink, (status) => {
                if (status === 'paid') {
                    resolve({ success: true, status: 'paid' });
                } else if (status === 'cancelled') {
                    resolve({ success: false, status: 'cancelled' });
                } else if (status === 'failed') {
                    resolve({ success: false, status: 'failed' });
                } else {
                    resolve({ success: false, status: status });
                }
            });
        });
    },
    
    async validatePayment(transactionId, payload) {
        const response = await fetch(`${this.API_ENDPOINT}/validate-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                initData: TelegramIntegration.getInitData(),
                transactionId: transactionId,
                payload: payload
            })
        });
        
        if (!response.ok) {
            throw new Error('Payment validation failed');
        }
        
        return await response.json();
    },
    
    async recordTransaction(transaction) {
        const response = await fetch(`${this.API_ENDPOINT}/record-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                initData: TelegramIntegration.getInitData(),
                transaction: transaction
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to record transaction');
        }
        
        return await response.json();
    },
    
    async syncGameData(gameData) {
        const response = await fetch(`${this.API_ENDPOINT}/sync-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                initData: TelegramIntegration.getInitData(),
                gameData: gameData
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync game data');
        }
        
        return await response.json();
    },
    
    async getGameData() {
        const response = await fetch(`${this.API_ENDPOINT}/sync-data?initData=${encodeURIComponent(TelegramIntegration.getInitData())}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get game data');
        }
        
        return await response.json();
    }
};