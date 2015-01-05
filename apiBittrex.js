var request = require('request');
var nonce   = require('nonce')();
var crypto = require('crypto').createHmac;

module.exports = function() {
    'use strict';

    // Module dependencies

    // Constants
    var version         = '0.1.0',
        PUBLIC_API_URL  = 'https://bittrex.com/api/v1.1/public',
        MARKET_API_URL = 'https://bittrex.com/api/v1.1/market',
	ACCOUNT_API_URL = 'https://bittrex.com/api/v1.1/account';

    // Constructor
    function Bittrex(key, secret){
        // Generate headers signed by this user's key and secret.
        // The secret is encapsulated and never exposed
        this._getPrivateHeaders = function(uri){
            var paramString, signature;
            if (!key || !secret){
                throw 'Bittrex: Error. API key and secret required';
            }
            signature = new crypto('sha512', secret).update(uri).digest('hex');
            return {
                apisign: signature
            };
        };
	this._getParams = function(parameters){
		var paramString = Object.keys(parameters).sort().map(function(param){
		return encodeURIComponent(param) + '=' + encodeURIComponent(parameters[param]);
		}).join('&');
		return 'apikey='+ key + '&' + paramString;
	}; 
    }

    // If a site uses non-trusted SSL certificates, set this value to false
    Bittrex.STRICT_SSL = true;

    // Helper methods
    function joinCurrencies(currencyA, currencyB){
        return currencyA + '-' + currencyB;
    }

    // Prototype
    Bittrex.prototype = {
        constructor: Bittrex,

        // Make an API request
        _request: function(options, callback){
            if (!('headers' in options)){
                options.headers = {};
            }
            options.json = true;
            options.strictSSL = Bittrex.STRICT_SSL;
            request(options, function(err, response, body) {
                callback(err, body);
            });
            return this;
        },

        // Make a public API request
        _public: function(parameters, callback){
            var options = {
                method: 'GET',
                url: PUBLIC_API_URL + parameters.command,
                qs: parameters
            };

            return this._request(options, callback);
        },

        // Make a private API request
        _private: function(url, parameters, callback){
            parameters.nonce = nonce();
	    var uri = url + this._getParams(parameters);
            var options = {
                method: 'GET',
                url: uri,
                headers: this._getPrivateHeaders(uri)
            };

            return this._request(options, callback);
        },

	//PUBLIC METHODS
	getMarkets: function(callback){
	   var parameters = {
		command: '/getmarkets'	
	   }
	   return this._public(parameters, callback);
	},

	getCurrencies: function(callback){
	    var parameters = {
	        command: '/getcurrencies'	
	    }
		return this._public(parameters,callback);
	},

	getTicker: function(currencyA, currencyB, callback){
		var parameters = {
			command: '/getticker',
			market: joinCurriencies(currencyA, currencyB)
		}
		return this._public(parameters, callback);
	},

        getOrderBook: function(currencyA, currencyB, type, depth, callback){
            var parameters = {
                command: '/getorderbook',
        	market: joinCurrencies(currencyA, currencyB),
		type: type,
		depth: depth   
	 }
            return this._public(parameters, callback);
        },

	getMarketSummaries: function(callback){
		var parameters = {
			command: '/getmarketsummaries',
		};
		return this._public(parameters, callback);
	},

	getMarketHistory: function(currencyA, currencyB, callback){
		var parameters = {
			market: joinCurrencies(currencyA, currencyB),
			command: '/getmarketsummary'
		};
		return this._public(parameters, callback);
	},

	// PRIVATE MARKET METHODS
	buyLimit: function(currencyA, currencyB, quantity, rate, callback){},
	buyMarket: function(currencyA, currencyB, quantity, callback){},
	sellLimit: function(currencyA, currencyB, quantity, rate, callback){
		var url = MARKET_API_URL + '/selllimit?';
		var parameters = {
			market: joinCurrencies(currencyA, currencyB),
			quantity: quantity,
			rate: rate
		};
		return this._private(url, parameters, callback);
	},
	sellMarket: function(currencyA, currencyB, quantity, callback){
		var url = MARKET_API_URL + '/sellmarket?';
		var parameters = {
			market: joinCurrencies(currencyA, currencyB),
			quantity: quantity
		};
		return this._private(url, parameters, callback);
	},
	cancelOrder: function(uuid, callback){
		var url = MARKET_API_URL + '/cancel?';
		var parameters = {
			uuid: uuid
		};
		return this._private(url, parameters, callback);
	},
	getOpenOrders: function(callback){
		var url = MARKET_API_URL + '/getopenorders?';
		var parameters= {};   
		return this._private(url, parameters, callback);
	},	
	
	//PRIVATE ACCOUNT METHODS
	getBalances: function(callback){
		var url = ACCOUNT_API_URL + '/getbalances?';
		var parameters = {};
		return this._private(url, parameters, callback);
	},
	getSingleBalance: function(currency, callback){
		var url = ACCOUNT_API_URL + '/getbalance?';
		var parameters = {
		currency: currency
		};
		return this._private(url, parameters, callback);
	},
	getDepositAddress: function(currency, callback){
		var url = ACCOUNT_API_URL + '/getdepositaddress?';
		var parameters = {
			currency: currency
		};
		return this._private(url, parameters, callback);
	},
	withdraw: function(currency, quantity, address, callback){
		var url = ACCOUNT_API_URL + '/withdraw?';
		var parameters = {
			currency: currency
		};
		return this._private(url, parameters, callback);
	},
	getOrder: function(uuid, callback){
		var url = ACCOUNT_API_URL + '/getorder?';
		var parameters = {
			uuid: uuid
		};
		return this._private(url, parameters, callback);
	},
	getOrderHistory: function(callback){
		var url = ACCOUNT_API_URL + '/getorderhistory?';
		var parameters = {};
		return this._private(url, parameters, callback);
	},
	getWithdrawalHistory: function(currency, count, callback){
 	        var url = ACCOUNT_API_URL + '/getwithdrawalhistory?';
                var parameters = {
                        currency: currency,
                        count: count
                };
                return this._private(url, parameters, callback);

	},
	getDepositHistory: function(currency, count,  callback){
		var url = ACCOUNT_API_URL + '/getdeposithistory?';
		var parameters = {
			currency: currency,
			count: count	
		};
		return this._private(url, parameters, callback);
	},


	//INTERNAL FUNCTIONS
	getTop: function(currencyA, currencyB, callback){
		this.getOrderBook(currencyB, currencyA, 'buy', 20, function(err, data){
			var newData = [];
			var holder = {};
			data = data.result;
			data.forEach(function(entry){
				holder = {};
				holder['price'] = entry['Rate'];
				holder['quantity'] = entry['Quantity'];
				newData.push(holder);
			});
			callback(err, newData);
			
		});
	},

	getBottom: function(currencyA, currencyB, callback){
		this.getOrderBook(currencyB, currencyA, 'sell', 20, function(err, data){
			var newData = [];
			var holder = {};
			data = data.result;
			data.forEach(function(entry){
				holder = {};
				holder['price'] = entry['Rate'];
				holder['quantity'] = entry['Quantity'];
				newData.push(holder);
			});
			callback(err, newData);
		});
	},

	getFunds: function(currency, callback){
		this.getSingleBalance(currency, function(err, data){
			if(data.result != null){
				data = data.result.Available
				callback(err, data);
			}
			else callback(err, 0);
		});	
	},
	
	getWallet: function(callback){
		var results = {};
		this.getBalances(function(err, data){
			if(data.result != null){
				data = data.result;
				data.forEach(function(result){
				results[result.Currency] = JSON.stringify(result.Available);
				});
			}
			callback(err, results);
		});
	},

	getAddress: function(currency, callback){
		this.getDepositAddress(currency, function(err, data){
			if(data.result != null){
				data = data.result.Address;
			}
			callback(err, data);
		});
	},
	confirmSale: function(currency, market, sellOrders, timeStamp, callback){
		var main = this;
		var open = {};
		var sold = {};
		var reply = [];
		var totalBtc;
		var response = function(sold, open, total){
			reply['sold'] = sold;
			reply['open'] = open;
			reply['total'] = total;
			callback(1, reply);
		};
		sellOrders.forEach(function(id, i){
			main.getOrder(id, function(err, data){
				data = data.result;
				totalBtc += data.Price;
				if(data.IsOpen == true){
					open[id]  = data.QuantityRemaining;
				}else if(data.IsOpen == false){ //sold
					sold[id] = data.Price; 
				}
				if( i == sellOrders.length -1 )response(sold, open, totalBtc);	
			});
		});
	},
	createSale: function(currency, market, quantity, rate, type, callback){
		this.sellLimit(market, currency, quantity, rate, function(err, data){
			console.log(data);
			if(data.result != null){
				data = data.result[0].resultUuid;
			}
		});
	},
	cancel: function(coin, market, uuid, callback){
		this.cancelOrder(uuid, function(err, data){
			if(data.success == true)callback(err, true);
			else callback(err, false);
		});
	}
    };

    return Bittrex;
}();
