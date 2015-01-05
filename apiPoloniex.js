var request = require('request');
var nonce   = require('nonce')();
var crypto = require('crypto').createHmac;

module.exports = function() {
    'use strict';

    // Module dependencies

    // Constants
    var version         = '0.1.0',
        PUBLIC_API_URL  = 'https://poloniex.com/public',
        PRIVATE_API_URL = 'https://poloniex.com/tradingApi'

    // Constructor
    function Poloniex(key, secret){
        // Generate headers signed by this user's key and secret.
        // The secret is encapsulated and never exposed
        this._getPrivateHeaders = function(parameters){
            var paramString, signature;

            if (!key || !secret){
                throw 'Poloniex: Error. API key and secret required';
            }

            // Sort parameters alphabetically and convert to `arg1=foo&arg2=bar`
            paramString = Object.keys(parameters).sort().map(function(param){
                return encodeURIComponent(param) + '=' + encodeURIComponent(parameters[param]);
            }).join('&');
            signature = new crypto('sha512', secret);
		signature.setEncoding('hex');
		signature.write(paramString);
		signature.end();

            return {
                Key: key,
                Sign: signature.read()
            };
        };
    }

    // If a site uses non-trusted SSL certificates, set this value to false
    Poloniex.STRICT_SSL = true;

	function formatParam(parameters){
		var paramString = Object.keys(parameters).sort().map(function(param){
			return encodeURIComponent(param) + '=' + encodeURIComponent(parameters[param]);
		}).join('&');
		return paramString;
	}

    // Helper methods
    function joinCurrencies(currencyA, currencyB){
        return currencyA + '_' + currencyB;
    }

    // Prototype
    Poloniex.prototype = {
        constructor: Poloniex,

        // Make an API request
        _request: function(options, callback){
            if (!('headers' in options)){
                options.headers = {};
            }

            options.json = true;
            options.strictSSL = Poloniex.STRICT_SSL;
            request(options, function(err, response, body) {
                callback(err, body);
            });

            return this;
        },

        // Make a public API request
        _public: function(parameters, callback){
            var options = {
                method: 'GET',
                url: PUBLIC_API_URL,
                qs: parameters
            };

            return this._request(options, callback);
        },

        // Make a private API request
        _private: function(parameters, callback){
            var options;

            parameters.nonce = nonce();
            options = {
                method: 'POST',
                url: PRIVATE_API_URL,
               form: parameters,
		 headers: this._getPrivateHeaders(parameters),
            };

            return this._request(options, callback);
        },


        /////


        // PUBLIC METHODS

        getTicker: function(callback){
            var parameters = {
                    command: 'returnTicker'
                };

            return this._public(parameters, callback);
        },

        get24hVolume: function(callback){
            var parameters = {
                    command: 'return24hVolume'
                };

            return this._public(parameters, callback);
        },
	getOrderBook: function(currencyA, currencyB, callback){
		var parameters = {
			command: 'returnOrderBook',
			currencyPair: joinCurrencies(currencyA, currencyB)
		};
	    return this._public(parameters, callback);
	},
        // PRIVATE METHODS

        myBalances: function(callback){
            var parameters = {
                    command: 'returnBalances'
                };

            return this._private(parameters, callback);
        },

        myOpenOrders: function(currencyA, currencyB, callback){
            var parameters = {
                    command: 'returnOpenOrders',
                    currencyPair: joinCurrencies(currencyA, currencyB)
                };

            return this._private(parameters, callback);
        },

        myTradeHistory: function(currencyA, currencyB, timeStamp, callback){
            var parameters = {
                    command: 'returnTradeHistory',
                    currencyPair: joinCurrencies(currencyA, currencyB)
		   // start: timeStamp
                };

            return this._private(parameters, callback);
        },

        buy: function(currencyA, currencyB, rate, amount, callback){
            var parameters = {
                    command: 'buy',
                    currencyPair: joinCurrencies(currencyA, currencyB),
                    rate: rate,
                    amount: amount
                };

            return this._private(parameters, callback);
        },

        sell: function(currencyA, currencyB, rate, amount, callback){
            var parameters = {
                    command: 'sell',
                    currencyPair: joinCurrencies(currencyA, currencyB),
                    rate: rate,
                    amount: amount
                };

            return this._private(parameters, callback);
        },

        cancelOrder: function(currencyA, currencyB, orderNumber, callback){
            var parameters = {
                    command: 'cancelOrder',
                    currencyPair: joinCurrencies(currencyA, currencyB),
                    orderNumber: orderNumber
                };

            return this._private(parameters, callback);
        },

        withdraw: function(currency, amount, address, callback){
            var parameters = {
                    command: 'withdraw',
                    currency: currency,
                    amount: amount,
                    address: address
                };

            return this._private(parameters, callback);
        },
//INTERNAL FUNCTIONS
	getTop: function(currencyA, currencyB, callback){
		this.getOrderBook(currencyB, currencyA, function(err, data){
			var newData = [];
			var holder = {};
			data = data.bids;
			data.forEach(function(entry){
				holder = {};
				holder['price'] = entry[0];
				holder['quantity'] = entry[1];
				newData.push(holder);
			});
			callback(err, newData);
		});
	},

	getBottom: function(currencyA, currencyB, callback){
		this.getOrderBook(currencyB, currencyA, function(err, data){
			var newData = [];
			var holder = {};
			data = data.asks;
			data.forEach(function(entry){
				holder = {};
				holder['price'] = entry[0];
				holder['quantity'] = entry[1];
				newData.push(holder);
			});
			callback(err, newData);
		});
	},
	getFunds: function(currency, callback){
		this.myBalances(function(err, data){
			data = data[currency];	
			callback(err, data);
		});
	},
	getWallet: function(callback){
		this.myBalances(function(err, data){
			callback(err, data);
		});
	},
	createSale: function(currency, market, quantity, rate, callback){
		this.sell(market, currency, rate, quantity, function(err, data){
			data = data['orderNumber'];
			callback(err, data);
		});
	},
	cancel: function(coin, market, orderId, callback){
		this.cancelOrder(market, coin, orderId, function(err, data){
			if(data.success == 1) callback(err, true);
			else callback(err, false);
		});
	},
	confirmSale: function(currency, market, orderIds, startTime, callback ){
		var main = this;
		var open = {};
		var sold = {};
		var reply = [];
		var soldIds = orderIds;
		var totalBtc;
		var response = function(sold, open, total){
			reply['sold'] = sold;
			reply['open'] = open;
			reply['total'] = total;
			callback(1, reply);
		};
		this.myOpenOrders(market, currency, function(err, data){
			orderIds.forEach(function(order, i){
				data.forEach(function(open){
					if(open.orderNumber == order){
						open[order] = open.amount;
						totalBtc += open.total;
						soldIds.splice(i - 1, 1);
						return;
					}
				});	
			});
			main.myTradeHistory(market, currency, startTime, function(err, data){
				soldIds.forEach(function(order, i){
					data.forEach(function(sold){
						if(sold.orderNumber == sold){
							sold[order] = sold.total;
							totalBtc += sold.total;
							return;
						}
						if(i == soldIds.length - 1) response(sold, open, totalBtc);
					});
				});
			});
		});
	}
    };

    return Poloniex;
}();
