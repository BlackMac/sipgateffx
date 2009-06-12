Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://sipgateffx/xmlrpc.js");

var xulObjReference = new Array();
var _sgffx;

function SipgateFFX() {
	this.wrappedJSObject = this;
	_sgffx = this;
	this.samuraiAuth = {
		"hostname": "chrome://sipgateffx",
		"formSubmitURL": null,
		"httprealm": 'sipgate Account Login',
		"username": null,
		"password": null
	};
	this.recommendedIntervals = {
		"samurai.BalanceGet": 60,
		"samurai.RecommendedIntervalGet": 60
	};
	this.samuraiServer = {
		"classic": "https://samurai.sipgate.net/RPC2",
		"team": "https://api.sipgate.net/RPC2",
		"dev": "http://samurai01.dev.sipgate.net/RPC2"
	};
	this.clientLang = 'en';
	this.mLogBuffer = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
	this.mLogBufferMaxSize = 1000;
	this.getBalanceTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
	this.getRecommendedIntervalsTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
	this.curBalance = null;
	this.isLoggedIn = false;
}

SipgateFFX.prototype = {
	classDescription: "sipgateFFX javascript XPCOM Component",
	classID: Components.ID("{BCC44C3C-B5E8-4566-8556-0D9230C7B4F9}"),
	contractID: "@api.sipgate.net/sipgateffx;1",
	QueryInterface: XPCOMUtils.generateQI(),
	
	 get password() {
		if (this.samuraiAuth.password) {
			return this.samuraiAuth.password;
		} else {
			return null;
		}
	},
	
	 get username() {
		if (this.samuraiAuth.username) {
			return this.samuraiAuth.username;
		} else {
			return null;
		}
	},
	
	 get language() {
		return this.clientLang;
	},
	
	
	 set language(lang) {
		if (lang == "de") {
			return this.clientLang = "de";
		} else {
			return this.clientLang = "en";
		}
	},
	
	get systemArea() {
		return "team";
	},
	
	oPrefService: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),
	
	setPref: function(aName, aValue, aType) {
		this.log(aName);
		try {
			if (aType == "bool") {
				this.oPrefService.setBoolPref(aName, aValue);
			} else if (aType == "int") {
				this.oPrefService.setIntPref(aName, aValue);
			} else if (aType == "char") {
				this.oPrefService.setCharPref(aName, aValue);
			}
			this.log("preference '" + aName + "' (" + aType + ") set to '" + aValue + "'");
		} 
		catch (e) {
			dump(e);
		}
	},
	
	getPref: function(aName, aType) {
		try {
			var result;
			if (aType == "int") {
				result = this.oPrefService.getIntPref(aName);
			} else if (aType == "char") {
				result = this.oPrefService.getCharPref(aName);
			} else if (aType == "bool") {
				result = this.oPrefService.getBoolPref(aName);
			}
			return result;
		} 
		catch (e) {
			if (aType == "int") {
				return 0;
			} else if (aType == "char") {
				return null;
			}
		}
		return null;
	},
	
	getSamuraiAuth: function() {
		// Login Manager exists so this is Firefox 3
		var passwordManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
		
		// Find users for the given parameters
		var logins = passwordManager.findLogins({}, this.samuraiAuth.hostname, this.samuraiAuth.formSubmitURL, this.samuraiAuth.httprealm);
		
		var username = null;
		var password = null;
		
		// Find user from returned array of nsILoginInfo objects
		this.log("Found passwords count: " + logins.length + "");
		for (var i = 0; i < logins.length; i++) {
			username = logins[i].username;
			password = logins[i].password;
			break;
		}
		
		this.samuraiAuth.username = username;
		this.samuraiAuth.password = password;
		return {
			'username': username,
			'password': password
		};
	},
	
	setSamuraiAuth: function(username, password) {
		try {
			// Get Login Manager 
			var passwordManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
			
			// Find users for this extension 
			var logins = passwordManager.findLogins({}, this.samuraiAuth.hostname, this.samuraiAuth.formSubmitURL, this.samuraiAuth.httprealm);
			
			this.log("Found passwords count: " + logins.length + "");
			for (var i = 0; i < logins.length; i++) {
				passwordManager.removeLogin(logins[i]);
			}
			
			var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1", Components.interfaces.nsILoginInfo, "init");
			
			var loginInfo = new nsLoginInfo(this.samuraiAuth.hostname, this.samuraiAuth.formSubmitURL, this.samuraiAuth.httprealm, username, password, "", "");
			passwordManager.addLogin(loginInfo);
			
		} 
		catch (ex) {
			// This will only happen if there is no nsILoginManager component class
			dump(ex);
		}
	},
	
	login: function() {
		this.log("*** sipgateffx: login *** BEGIN ***");
		
		if (this.isLoggedIn) {
			this.log("*** sipgateffx: login *** ALREADY LOGGED IN ***");
			return;
		}
		
		var result = function(ourParsedResponse, aXML) {
			if (ourParsedResponse.StatusCode && ourParsedResponse.StatusCode == 200) {
			
				_sgffx.setXulObjectVisibility('showcreditmenuitem', 1);
				_sgffx.setXulObjectVisibility('pollbalance', 1);
				_sgffx.setXulObjectVisibility('showvoicemailmenuitem', 1);
				_sgffx.setXulObjectVisibility('showphonebookmenuitem', 1);
				_sgffx.setXulObjectVisibility('showsmsformmenuitem', 1);
				_sgffx.setXulObjectVisibility('showhistorymenuitem', 1);
				_sgffx.setXulObjectVisibility('showfaxmenuitem', 1);
				_sgffx.setXulObjectVisibility('showshopmenuitem', 1);
				_sgffx.setXulObjectVisibility('showitemizedmenuitem', 1);
				_sgffx.setXulObjectVisibility('dialactivate', 1);
				_sgffx.setXulObjectVisibility('item_logoff', 1);
				_sgffx.setXulObjectVisibility('separator1', 1);
				_sgffx.setXulObjectVisibility('separator2', 1);
				_sgffx.setXulObjectVisibility('dialdeactivate', 1);
				
				_sgffx.setXulObjectVisibility('item_logon', 0);
				
				_sgffx.setXulObjectVisibility('sipgateffx_loggedout', 0);
				_sgffx.setXulObjectVisibility('sipgateffx_loggedin', 1);
				
				_sgffx.isLoggedIn = true;
				
				_sgffx.log("*** NOW logged in ***");
				_sgffx.getRecommendedIntervals();
				_sgffx.getBalance();
			}
		};
		
		var request = bfXMLRPC.makeXML("system.serverInfo", [this.samuraiServer[this.systemArea]]);
		this.log(request);
		
		this._rpcCall(request, result);
		this.log("*** sipgateffx: login *** END ***");
	},
	
	logoff: function() {
		if (!this.isLoggedIn) {
			this.log("*** sipgateffx: logoff *** USER NOT LOGGED IN ***");
			return;
		}		
			
		this.isLoggedIn = false;
		
		this.setXulObjectVisibility('showcreditmenuitem', 0);
		this.setXulObjectVisibility('pollbalance', 0);
		this.setXulObjectVisibility('showvoicemailmenuitem', 0);
		this.setXulObjectVisibility('showphonebookmenuitem', 0);
		this.setXulObjectVisibility('showsmsformmenuitem', 0);
		this.setXulObjectVisibility('showhistorymenuitem', 0);
		this.setXulObjectVisibility('showfaxmenuitem', 0);
		this.setXulObjectVisibility('showshopmenuitem', 0);
		this.setXulObjectVisibility('showitemizedmenuitem', 0);
		this.setXulObjectVisibility('dialactivate', 0);
		this.setXulObjectVisibility('item_logoff', 0);
		this.setXulObjectVisibility('separator1', 0);
		this.setXulObjectVisibility('separator2', 0);
		this.setXulObjectVisibility('dialdeactivate', 0);
		
		this.setXulObjectVisibility('item_logon', 1);

		this.setXulObjectVisibility('sipgateffx_loggedout', 1);
		this.setXulObjectVisibility('sipgateffx_loggedin', 0);
		
		this.log("*** NOW logged off ***");
	},
	
	getRecommendedIntervals: function() {
		this.log("*** sipgateffx: getRecommendedIntervals *** BEGIN ***");
		if (!this.isLoggedIn) {
			this.log("*** sipgateffx: getRecommendedIntervals *** USER NOT LOGGED IN ***");
			return;
		}
		
		var result = function(ourParsedResponse, aXML) {
			if (ourParsedResponse.StatusCode && ourParsedResponse.StatusCode == 200) {
				if (ourParsedResponse.IntervalList.length > 0) {
					for (var i = 0; i < ourParsedResponse.IntervalList.length; i++) {
						_sgffx.recommendedIntervals[ourParsedResponse.IntervalList[i].MethodName] = ourParsedResponse.IntervalList[i].RecommendedInterval;
						_sgffx.log(ourParsedResponse.IntervalList[i].MethodName + " = " + ourParsedResponse.IntervalList[i].RecommendedInterval);
					}
					if (_sgffx.getPref("extensions.sipgateffx.polling", "bool")) {
						// set update timer
						var delay = _sgffx.recommendedIntervals["samurai.RecommendedIntervalGet"];
						
						_sgffx.getRecommendedIntervalsTimer.initWithCallback({
							notify: function(timer) {
								_sgffx.getRecommendedIntervals();
							}
						}, delay * 1000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
						
						_sgffx.log("getRecommendedIntervals: polling enabled. set to " + delay + " seconds");
					}
				}
			} else {
				_sgffx.log("getRecommendedIntervals failed toSTRING: "+ aXML.toString());
			}
		};
		
		var params = {
			'MethodList': [new String("samurai.RecommendedIntervalGet"), new String("samurai.BalanceGet"), new String("samurai.UmSummaryGet")]
		};
		
		var request = bfXMLRPC.makeXML("samurai.RecommendedIntervalGet", [this.samuraiServer[this.systemArea], params]);
		this.log(request);
		
		this._rpcCall(request, result);
		this.log("*** sipgateffx: getRecommendedIntervals *** END ***");
	},
	
	getBalance: function() {
		this.log("*** sipgateffx: getBalance *** BEGIN ***");
		if (!this.isLoggedIn) {
			this.log("*** sipgateffx: sipgateffx *** USER NOT LOGGED IN ***");
			return;
		}
		
		var setBalance = function() {
			_sgffx.setXulObjectAttribute('BalanceText', "value", _sgffx.curBalance[0]);
			
			// display the balance value:
			if (_sgffx.curBalance[1] < 5.0) {
				_sgffx.setXulObjectAttribute('BalanceText', "style", "cursor: pointer; color: red;");
			} else {
				_sgffx.setXulObjectAttribute('BalanceText', "style", "cursor: pointer;");
			}
		};
		
		if(this.curBalance != null) {
			setBalance();
			return;
		}
		
		var result = function(ourParsedResponse, aXML) {
			if (ourParsedResponse.StatusCode && ourParsedResponse.StatusCode == 200) {
			
				var balance = ourParsedResponse.CurrentBalance;
				var currency = balance.Currency;
				var balanceValueDouble = balance.TotalIncludingVat;
				
				var balanceValueString = balanceValueDouble;
				
				// dirty hack to localize floats:
				if (_sgffx.clientLang == "de") {
					// german floats use "," as delimiter for mantissa:
					balanceValueString = balanceValueDouble.toFixed(2).toString();
					balanceValueString = balanceValueString.replace(/\./, ",");
				} else {
					balanceValueString = balanceValueDouble.toFixed(2).toString();
				}
				
				_sgffx.curBalance = [balanceValueString + " " + currency, balanceValueDouble];
				setBalance();
				
				if (_sgffx.getPref("extensions.sipgateffx.polling", "bool")) {
					// set update timer
					var delay = _sgffx.recommendedIntervals["samurai.BalanceGet"];
					
					_sgffx.getBalanceTimer.initWithCallback({
						notify: function(timer) {
							_sgffx.curBalance = null;
							_sgffx.getBalance();
						}
					}, delay * 1000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
					
					_sgffx.log("getBalance: polling enabled. set to " + delay + " seconds");
				}
				
			}
		};
		
		var request = bfXMLRPC.makeXML("samurai.BalanceGet", [this.samuraiServer[this.systemArea]]);
		this.log(request + "");
		
		this._rpcCall(request, result);
		
		this.log("*** sipgateffx: getBalance *** END ***");
		
		
	},
	
	getOwnUriList: function () {
		this.log("*** getOwnUriList *** BEGIN ***");
		if (!this.isLoggedIn) {
			this.log("*** getOwnUriList *** USER NOT LOGGED IN ***");
			return;
		}
		
		var result = function(ourParsedResponse, aXML) {
			if (ourParsedResponse.StatusCode && ourParsedResponse.StatusCode == 200) {
				if (ourParsedResponse.OwnUriList.length > 0) {
					for (var i = 0; i < ourParsedResponse.OwnUriList.length; i++) {
						_sgffx.log(ourParsedResponse.IntervalList[i].MethodName + " = ");
						_sgffx.log(ourParsedResponse.IntervalList[i].RecommendedInterval + "");
					}
				}
			}
		};
		
		var request = bfXMLRPC.makeXML("samurai.OwnUriListGet", [this.samuraiServer[this.systemArea]]);
		this.log(request + "");
		
		this._rpcCall(request, result);
		this.log("*** getOwnUriList *** END ***");		
		return ownUriList; 
	},

	_rpcCall: function(request, callbackResult, callbackError) {
		var user = this.username;
		var pass = this.password;
		
		if (user == null || pass == null) {
			var retVal = this.getSamuraiAuth();
			if (retVal.username == null || retVal.password == null) {
				this.log("could not be authorized");
				return;
			}
			
			user = retVal.username;
			pass = retVal.password;
		}
		
		//PffXmlHttpReq( aUrl, aType, aContent, aDoAuthBool, aUser, aPass) 
		var theCall = new PffXmlHttpReq(this.samuraiServer[this.systemArea], "POST", request, true, user, pass);
		
		theCall.onResult = function(aText, aXML) {
			var re = /(\<\?\xml[0-9A-Za-z\D]*\?\>)/;
			var newstr = aText.replace(re, "");
			
			try {
				var e4xXMLObject = new XML(newstr);
			} 
			catch (e) {
				alert("malformedXML");
				return;
			}

			if (e4xXMLObject.name() != 'methodResponse' ||
			!(e4xXMLObject.params.param.value.length() == 1 ||
			e4xXMLObject.fault.value.struct.length() == 1)) {
				if (aText != '') {
					alert("XML Response:" + aText);
				}
			}
			
			if (e4xXMLObject.params.param.value.length() == 1) {
				ourParsedResponse = bfXMLRPC.XMLToObject(e4xXMLObject.params.param.value.children()[0]);
			}
			
			if (e4xXMLObject.fault.children().length() > 0) {
				ourParsedResponse = bfXMLRPC.XMLToObject(e4xXMLObject.fault.value.children()[0]);
			}
			
			if (typeof(callbackResult) == 'function') {
				callbackResult(ourParsedResponse, aXML);
			} else {
				alert("Good Result:" + aText);
				alert("Good Result:" + aXML);
			}
		};
		
		var errString = this.strings;
		
		theCall.onError = function(aStatusMsg, Msg) {
			var errorMessage = '';
			
			if (typeof(callbackError) == 'function') {
				callbackError(aStatusMsg, Msg);
				return;
			}
			
			switch (theCall.request.status) {
				case 401:
					errorMessage = "status.401";
					break;
				case 403:
					errorMessage = "status.403";
					break;
				case 404:
					errorMessage = "status.404";
					break;
				default:
					errorMessage = Msg;
					break;
			}
			
			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
			promptService.alert(window, errString.getString("helloMessageTitle"), errString.getString(errorMessage));
			
		};
		
		theCall.prepCall(); //Set up The call (open connection, etc.)
		theCall.request.setRequestHeader("Content-Type", "text/xml");
		theCall.makeCall(); //Make the call
		theCall.request.overrideMimeType('text/xml');
	},
	
	niceNumber: function (_number, natprefix) {
		try {
			_number = _number.toString().replace(/\s+/g, "");
			_number = _number.toString().replace(/^\+/, "");
			_number = _number.toString().replace(/\./g, "");
			_number = _number.toString().replace(/-/g, "");
			_number = _number.toString().replace(/43\(0+\)/, "43");
			_number = _number.toString().replace(/43\[0+\]/, "43");
			_number = _number.toString().replace(/44\(0+\)/, "44");
			_number = _number.toString().replace(/44\[0+\]/, "44");
			_number = _number.toString().replace(/49\(0+\)/, "49");
			_number = _number.toString().replace(/49\[0+\]/, "49");
			
			this.log("_niceNumber(): number before: "+_number);
			if (_number.toString().match(/^\(\d\d\d\)/)) {
				// transform american prefixes with 3-digit prefix (eg. "(123) 456789") to international format:
				_number = _number.toString().replace(/\(/, "");
				_number = _number.toString().replace(/\)/, "");
				_number = _number.toString().replace(/^/, "1");
			} else if (_number.toString().match(/^\(0[^0]\d+\)/)) { 
				// prefix like "(0211) ...":
				_number = _number.toString().replace(/\(0/, natprefix);
				_number = _number.toString().replace(/\)/, "");
			} else if (_number.toString().match(/^0[^0]/)) { 
				// prefix like "0211 ...":
				_number = _number.toString().replace(/^0/, natprefix);
			}
			_number = _number.toString().replace(/[^\d]/g, "");
			_number = _number.toString().replace(/^00/, "");
			this.log("_niceNumber(): number after: "+_number);
		} catch (ex) {
			this.log("Error in _niceNumber(): "+ex);
		}
		return _number;
	},
	
	logBufferDump: function () {
		return this.mLogBuffer;
	},

	log: function (logMessage) {
		try {
			var jetzt = new Date();
			var timestampFloat = jetzt.getTime() / 1000;
			var _CStringLogMessage = Components.classes["@mozilla.org/supports-cstring;1"].createInstance(Components.interfaces.nsISupportsCString);
			_CStringLogMessage.data = "[" + timestampFloat.toFixed(3) + "] " + logMessage;
			this.mLogBuffer.AppendElement(_CStringLogMessage);
			if(this.getPref("extensions.sipgateffx.debug","bool")) {
					// create instance of console-service for logging to JS-console:
					var _consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
					if(this.getPref("extensions.sipgateffx.debug2terminal","bool")) {
							dump("[" + timestampFloat.toFixed(3) + "] " + logMessage + "\n");
					} else {
							_consoleService.logStringMessage("[" + timestampFloat.toFixed(3) + "] " + logMessage + "\n");
					}
			}
			while (this.mLogBuffer.Count() > this.mLogBufferMaxSize) {
				this.mLogBuffer.DeleteElementAt(0);
			}
		} catch (ex) {
			dump("Error in _log(): "+ex+"\n");
		}
	},
	
	setXulObjectReference: function(id, obj) {
		if (typeof(xulObjReference[id]) != 'object') {
			// this.log("xulObjReference to " + id + " not defined as Array");
			xulObjReference[id] = new Array();
		}
		xulObjReference[id].push(obj);
	},
	
	setXulObjectVisibility: function(id, visible, forced) {
		if (visible == 1) {
			this.setXulObjectAttribute(id, "hidden", "false", forced);
		} else {
			this.setXulObjectAttribute(id, "hidden", "true", forced);
		}
	},
	
	setXulObjectAttribute: function(id, attrib_name, new_value, forced) {
		if (typeof(xulObjReference[id]) == 'object') {
			var xulObj = xulObjReference[id];
			for (var k = 0; k < xulObj.length; k++) {
				if (attrib_name == "src") {
					xulObj[k] = xulObj[k].QueryInterface(Components.interfaces.nsIDOMXULImageElement);
				} else {
					xulObj[k] = xulObj[k].QueryInterface(Components.interfaces.nsIDOMXULElement);
				}
				// this.log("set attribute '" + attrib_name + "' of '" + id + "' to '" + new_value + "'");
				xulObj[k].setAttribute(attrib_name, new_value);
			}
		} else {
			this.log("No reference to XUL-Objects of " + id + "!");
		}
	},



};
var components = [SipgateFFX];

function NSGetModule(compMgr, fileSpec) {
	return XPCOMUtils.generateModule(components);
}

